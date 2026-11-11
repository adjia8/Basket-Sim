import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { recordTradeNews } from "@/lib/data-access/league-news";
import { checkTradeSide } from "@/lib/careers/cap-rules";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { isRegularSeason } from "@/lib/careers/awards-rules";
import { pickTradeValue, playerTradeValue } from "@/lib/careers/trade-rules";
import { aiTradeOfferMessageText } from "@/lib/careers/inbox-rules";
import type { Locale } from "@/lib/i18n/locale";

// Offres aux GM humains : au plus une tentative tous les 12 jours de
// calendrier par GM, une chance sur deux — ~6-8 offres par saison.
const OFFER_COOLDOWN_DAYS = 12;
const OFFER_CHANCE = 0.5;
// Échanges entre équipes IA : au plus un tous les 6 jours de calendrier
// pour toute la ligue, avec une chance sur deux — ~10-12 par saison.
const AI_AI_COOLDOWN_DAYS = 6;
const AI_AI_CHANCE = 0.5;
// Fourchette de valeur que l'acheteur accepte de donner pour la cible.
const MIN_GIVE_RATIO = 0.9;
const MAX_GIVE_RATIO = 1.08;
// Entre deux IA, le vendeur exige au moins 97 % de ce qu'il cède.
const AI_SELLER_MIN_RATIO = 0.97;

interface Asset {
  kind: "player" | "pick";
  id: string;
  value: number;
  salary: number;
  label: string;
  age: number;
}

interface PlayerAsset extends Asset {
  kind: "player";
  overall: number;
  injured: boolean;
  teamId: string;
}

type Profile = "contender" | "rebuild" | "middle";

function profileFor(winPct: number, gamesPlayed: number): Profile {
  if (gamesPlayed < 10) return "middle";
  if (winPct >= 0.55) return "contender";
  if (winPct <= 0.4) return "rebuild";
  return "middle";
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Tout ce qu'il faut pour construire des offres, chargé une seule fois.
async function loadMarket(careerId: string, leagueId: string, season: string, locale: Locale) {
  const [contracts, standings, league, picks, rosterCounts] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId, contractType: "standard" },
      select: {
        teamId: true,
        playerId: true,
        salary: true,
        player: {
          select: {
            firstName: true,
            lastName: true,
            playerStates: { where: { careerId }, select: { overallRating: true, age: true, injured: true } },
          },
        },
      },
    }),
    getStandings(careerId, leagueId, season),
    getLeagueById(leagueId),
    prisma.draftPick.findMany({ where: { careerId, status: "pending" }, include: { originalTeam: true } }),
    prisma.contract.groupBy({ by: ["teamId"], where: { careerId }, _count: true }),
  ]);
  const teamCount = standings.length || 30;
  const byTeam = new Map<string, PlayerAsset[]>();
  for (const c of contracts) {
    const st = c.player.playerStates[0];
    const asset: PlayerAsset = {
      kind: "player",
      id: c.playerId,
      value: playerTradeValue(st?.overallRating ?? 60, st?.age ?? 27),
      salary: c.salary,
      label: `${c.player.firstName} ${c.player.lastName}`,
      age: st?.age ?? 27,
      overall: st?.overallRating ?? 60,
      injured: st?.injured ?? false,
      teamId: c.teamId,
    };
    byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), asset]);
  }
  const picksOf = (teamId: string): Asset[] =>
    picks
      .filter((p) => p.teamId === teamId)
      .slice(0, 4)
      .map((p) => ({
        kind: "pick",
        id: p.id,
        value: pickTradeValue(p.round, p.pickNumber, teamCount),
        salary: 0,
        label:
          locale === "fr"
            ? `choix de ${p.round === 1 ? "1er" : "2e"} tour ${p.season} (${p.originalTeam.abbreviation})`
            : `${p.season} round ${p.round} pick (${p.originalTeam.abbreviation})`,
        age: 0,
      }));
  const profiles = new Map(
    standings.map((r) => [r.teamId, profileFor(winPctForStandings(r.wins, r.losses), r.wins + r.losses)])
  );
  return {
    leagueId,
    salaryCap: league?.salaryCap ?? Infinity,
    minRoster: MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba,
    maxRoster: MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba,
    byTeam,
    picksOf,
    profiles,
    standings,
    rosterSize: new Map(rosterCounts.map((r) => [r.teamId, r._count])),
  };
}

type Market = Awaited<ReturnType<typeof loadMarket>>;

// Paquet que `buyerTeamId` propose pour `target` : 1 ou 2 joueurs (jamais
// ses 2 meilleurs) et éventuellement un pick, de valeur proche, en
// respectant le plafond salarial et la taille des effectifs. `assetFilter`
// restreint ce que l'acheteur cède (ex. des jeunes pour un vendeur en
// reconstruction). Renvoie l'un des 3 meilleurs paquets (un peu de variété).
async function packageFor(
  careerId: string,
  market: Market,
  buyerTeamId: string,
  target: PlayerAsset,
  options: { allowPicks: boolean; assetFilter?: (a: PlayerAsset) => boolean; minRatio?: number }
): Promise<Asset[] | null> {
  const roster = [...(market.byTeam.get(buyerTeamId) ?? [])].sort((a, b) => b.value - a.value);
  const playerAssets: Asset[] = roster
    .slice(2)
    .filter((p) => !p.injured && p.value > 0 && (options.assetFilter ? options.assetFilter(p) : true))
    .slice(0, 12);
  const pickAssets = options.allowPicks ? market.picksOf(buyerTeamId) : [];
  const [buyerPayroll, ownerPayroll] = await Promise.all([
    getPayrollForTeam(careerId, buyerTeamId),
    getPayrollForTeam(careerId, target.teamId),
  ]);
  const buyerSize = market.rosterSize.get(buyerTeamId) ?? 15;
  const ownerSize = market.rosterSize.get(target.teamId) ?? 15;

  const combos: Asset[][] = [];
  for (let i = 0; i < playerAssets.length; i++) {
    combos.push([playerAssets[i]]);
    for (let j = i + 1; j < playerAssets.length; j++) combos.push([playerAssets[i], playerAssets[j]]);
  }
  for (const base of [...combos]) for (const pick of pickAssets) combos.push([...base, pick]);

  const minRatio = options.minRatio ?? MIN_GIVE_RATIO;
  const valid: { assets: Asset[]; gap: number }[] = [];
  for (const assets of combos) {
    const given = assets.reduce((s, a) => s + a.value, 0);
    if (given < target.value * minRatio || given > target.value * MAX_GIVE_RATIO) continue;
    const players = assets.filter((a) => a.kind === "player");
    const salaryOut = players.reduce((s, a) => s + a.salary, 0);
    const capOk =
      checkTradeSide(market.leagueId, market.salaryCap, buyerPayroll, salaryOut, target.salary).ok &&
      checkTradeSide(market.leagueId, market.salaryCap, ownerPayroll, target.salary, salaryOut).ok;
    if (!capOk) continue;
    const newOwner = ownerSize - 1 + players.length;
    const newBuyer = buyerSize - players.length + 1;
    if ((newOwner > market.maxRoster && newOwner > ownerSize) || (newBuyer < market.minRoster && newBuyer < buyerSize)) continue;
    if ((newBuyer > market.maxRoster && newBuyer > buyerSize) || (newOwner < market.minRoster && newOwner < ownerSize)) continue;
    valid.push({ assets, gap: Math.abs(given - target.value * 0.98) + players.length * 5 });
  }
  if (valid.length === 0) return null;
  const top = valid.sort((a, b) => a.gap - b.gap).slice(0, 3);
  return top[Math.floor(Math.random() * top.length)].assets;
}

// ---------------------------------------------------------------------------
// Offres d'une équipe IA à un GM humain

async function buildOfferToHuman(careerId: string, market: Market, humanTeamId: string, humanTeamIds: Set<string>) {
  // Cibles : joueurs valides d'au moins 74 ; la star n'est visée qu'une fois sur quatre.
  const humanPlayers = [...(market.byTeam.get(humanTeamId) ?? [])].filter((p) => !p.injured).sort((a, b) => b.value - a.value);
  const star = humanPlayers[0];
  const targetsBase = humanPlayers.filter((p) => p.overall >= 74 && (p !== star || Math.random() < 0.25));
  if (targetsBase.length === 0) return null;

  for (const row of shuffle(market.standings.filter((s) => !humanTeamIds.has(s.teamId))).slice(0, 10)) {
    const profile = market.profiles.get(row.teamId) ?? "middle";
    const targets = targetsBase.filter((p) =>
      profile === "contender" ? p.age >= 24 && p.overall >= 76 : profile === "rebuild" ? p.age <= 24 : true
    );
    if (targets.length === 0) continue;
    const target = targets[Math.floor(Math.random() * targets.length)];
    // Une équipe en reconstruction cède ses vétérans, sans picks.
    const assets = await packageFor(careerId, market, row.teamId, target, {
      allowPicks: profile !== "rebuild",
      assetFilter: profile === "rebuild" ? (a) => a.age >= 26 : undefined,
    });
    if (assets) return { aiTeamId: row.teamId, target, assets };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Échanges entre équipes IA : une équipe qui joue le titre achète un
// vétéran à une équipe en reconstruction, contre des jeunes ou des picks.

async function executeTrade(
  careerId: string,
  season: string,
  sellerTeamId: string,
  buyerTeamId: string,
  target: PlayerAsset,
  assets: Asset[]
): Promise<void> {
  const players = assets.filter((a) => a.kind === "player").map((a) => a.id);
  const picks = assets.filter((a) => a.kind === "pick").map((a) => a.id);
  await prisma.$transaction([
    prisma.contract.update({
      where: { careerId_playerId: { careerId, playerId: target.id } },
      data: { teamId: buyerTeamId },
    }),
    ...players.map((playerId) =>
      prisma.contract.update({ where: { careerId_playerId: { careerId, playerId } }, data: { teamId: sellerTeamId } })
    ),
    ...picks.map((id) => prisma.draftPick.updateMany({ where: { id, status: "pending" }, data: { teamId: sellerTeamId } })),
    prisma.playerTeamStint.create({
      data: { careerId, playerId: target.id, teamId: buyerTeamId, season, reason: "traded" },
    }),
    ...players.map((playerId) =>
      prisma.playerTeamStint.create({ data: { careerId, playerId, teamId: sellerTeamId, season, reason: "traded" } })
    ),
  ]);
}

async function maybeAiAiTrade(
  careerId: string,
  market: Market,
  season: string,
  humanTeamIds: Set<string>,
  locale: Locale
): Promise<boolean> {
  const aiRows = market.standings.filter((s) => !humanTeamIds.has(s.teamId));
  const buyers = shuffle(aiRows.filter((r) => market.profiles.get(r.teamId) === "contender"));
  const sellers = shuffle(aiRows.filter((r) => market.profiles.get(r.teamId) === "rebuild"));
  for (const seller of sellers.slice(0, 5)) {
    const veterans = (market.byTeam.get(seller.teamId) ?? []).filter((p) => !p.injured && p.age >= 26 && p.overall >= 76);
    if (veterans.length === 0) continue;
    const target = veterans[Math.floor(Math.random() * veterans.length)];
    for (const buyer of buyers.slice(0, 5)) {
      // Le vendeur veut de la jeunesse : joueurs de 25 ans ou moins, ou des picks.
      const assets = await packageFor(careerId, market, buyer.teamId, target, {
        allowPicks: true,
        assetFilter: (a) => a.age <= 25,
        minRatio: AI_SELLER_MIN_RATIO,
      });
      if (!assets) continue;
      await executeTrade(careerId, season, seller.teamId, buyer.teamId, target, assets);
      await recordTradeNews(
        careerId,
        season,
        buyer.teamId,
        seller.teamId,
        [target.id],
        assets.filter((a) => a.kind === "player").map((a) => a.id),
        locale,
        assets.filter((a) => a.kind === "pick").map((a) => a.label)
      );
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------

// Appelée après les lots de matchs : offres de l'IA aux GM humains (offre en
// attente dans la page Échanges, message dans la boîte de réception ;
// « Continuer » s'arrête) et échanges entre équipes IA (conclus aussitôt,
// annoncés dans l'actualité).
export async function maybeAiTradeOffers(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  if (!isRegularSeason(season)) return;
  const [memberships, lastPlayed, deadlinePassed, career] = await Promise.all([
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
    prisma.game.findFirst({ where: { careerId, season, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    isTradeDeadlinePassed(careerId, season),
    prisma.career.findUnique({ where: { id: careerId }, select: { lastAiAiTradeAt: true } }),
  ]);
  if (!lastPlayed || deadlinePassed) return;
  const today = lastPlayed.gameDate;
  const daysSince = (d: Date | null | undefined) => (d ? (today.getTime() - d.getTime()) / 86_400_000 : Infinity);
  const humanTeamIds = new Set(memberships.map((m) => m.teamId));
  let market: Market | null = null;
  const getMarket = async () => (market ??= await loadMarket(careerId, leagueId, season, locale));

  // Échanges entre équipes IA.
  if (daysSince(career?.lastAiAiTradeAt) >= AI_AI_COOLDOWN_DAYS) {
    await prisma.career.update({ where: { id: careerId }, data: { lastAiAiTradeAt: today } });
    if (Math.random() < AI_AI_CHANCE) {
      const traded = await maybeAiAiTrade(careerId, await getMarket(), season, humanTeamIds, locale);
      if (traded) market = null; // effectifs modifiés : recharger avant une offre au GM
    }
  }

  // Offres aux GM humains.
  for (const teamId of humanTeamIds) {
    const state = await getOrCreateTeamState(careerId, teamId, leagueId);
    if (daysSince(state.lastAiTradeOfferAt) < OFFER_COOLDOWN_DAYS) continue;
    await prisma.teamState.update({ where: { id: state.id }, data: { lastAiTradeOfferAt: today } });
    const pendingFromAi = await prisma.tradeOffer.count({
      where: { careerId, toTeamId: teamId, status: "pending", fromTeamId: { notIn: [...humanTeamIds] } },
    });
    if (pendingFromAi > 0 || Math.random() >= OFFER_CHANCE) continue;

    const offer = await buildOfferToHuman(careerId, await getMarket(), teamId, humanTeamIds);
    if (!offer) continue;
    await prisma.tradeOffer.create({
      data: {
        careerId,
        fromTeamId: offer.aiTeamId,
        toTeamId: teamId,
        items: {
          create: [
            ...offer.assets.map((a) => (a.kind === "player" ? { playerId: a.id, side: "from" } : { draftPickId: a.id, side: "from" })),
            { playerId: offer.target.id, side: "to" },
          ],
        },
      },
    });
    const team = await prisma.team.findUnique({ where: { id: offer.aiTeamId }, select: { city: true, name: true } });
    const msg = aiTradeOfferMessageText(
      locale,
      team ? `${team.city} ${team.name}` : offer.aiTeamId,
      offer.target.label,
      offer.assets.map((a) => a.label)
    );
    await createInboxMessage(careerId, teamId, season, "trade_offer", msg.title, msg.body, "/trades", {
      gameDate: today,
      playerId: offer.target.id,
    });
  }
}

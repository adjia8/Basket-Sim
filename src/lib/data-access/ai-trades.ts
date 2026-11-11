import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { checkTradeSide } from "@/lib/careers/cap-rules";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { isRegularSeason } from "@/lib/careers/awards-rules";
import { pickTradeValue, playerTradeValue } from "@/lib/careers/trade-rules";
import { aiTradeOfferMessageText } from "@/lib/careers/inbox-rules";
import type { Locale } from "@/lib/i18n/locale";

// Au plus une tentative tous les 12 jours de calendrier par GM humain, et
// une chance sur deux qu'une équipe IA se manifeste : ~6-8 offres par saison.
const OFFER_COOLDOWN_DAYS = 12;
const OFFER_CHANCE = 0.5;
// Fourchette de valeur que l'IA accepte de donner pour la cible : une offre
// crédible, ni une arnaque ni un cadeau.
const MIN_GIVE_RATIO = 0.9;
const MAX_GIVE_RATIO = 1.08;

interface Asset {
  kind: "player" | "pick";
  id: string;
  value: number;
  salary: number;
  label: string;
  age: number;
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

// Une équipe IA fait parfois une offre à un GM humain (voir
// maybeAiTradeOffers) : une équipe qui joue le titre vise un joueur
// confirmé, une équipe en reconstruction un jeune ; elle propose 1 ou 2
// joueurs (jamais ses 2 meilleurs) et éventuellement un pick, de valeur
// proche, en respectant le plafond salarial et la taille des effectifs.
async function buildOffer(
  careerId: string,
  leagueId: string,
  season: string,
  humanTeamId: string,
  humanTeamIds: Set<string>,
  locale: Locale
) {
  const [contracts, standings, league, picks] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId, contractType: "standard" },
      select: {
        teamId: true,
        playerId: true,
        salary: true,
        player: {
          select: { firstName: true, lastName: true, playerStates: { where: { careerId }, select: { overallRating: true, age: true, injured: true } } },
        },
      },
    }),
    getStandings(careerId, leagueId, season),
    getLeagueById(leagueId),
    prisma.draftPick.findMany({ where: { careerId, status: "pending" }, include: { originalTeam: true } }),
  ]);
  const teamCount = standings.length || 30;
  const toAsset = (c: (typeof contracts)[number]) => {
    const st = c.player.playerStates[0];
    return {
      kind: "player" as const,
      id: c.playerId,
      value: playerTradeValue(st?.overallRating ?? 60, st?.age ?? 27),
      salary: c.salary,
      label: `${c.player.firstName} ${c.player.lastName}`,
      age: st?.age ?? 27,
      overall: st?.overallRating ?? 60,
      injured: st?.injured ?? false,
      teamId: c.teamId,
    };
  };
  const byTeam = new Map<string, ReturnType<typeof toAsset>[]>();
  for (const c of contracts) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), toAsset(c)]);
  const rosterSize = async (teamId: string) => prisma.contract.count({ where: { careerId, teamId } });
  const salaryCap = league?.salaryCap ?? Infinity;
  const minRoster = MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba;
  const maxRoster = MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba;

  // Cibles possibles chez le GM : joueurs valides d'au moins 74 ; la star de
  // l'équipe n'est visée qu'une fois sur quatre.
  const humanPlayers = (byTeam.get(humanTeamId) ?? []).filter((p) => !p.injured).sort((a, b) => b.value - a.value);
  const star = humanPlayers[0];
  const targetsBase = humanPlayers.filter((p) => p.overall >= 74 && (p !== star || Math.random() < 0.25));
  if (targetsBase.length === 0) return null;

  const humanPayroll = await getPayrollForTeam(careerId, humanTeamId);
  const humanSize = await rosterSize(humanTeamId);

  const aiTeams = shuffle(standings.filter((s) => !humanTeamIds.has(s.teamId)));
  for (const row of aiTeams.slice(0, 10)) {
    const profile = profileFor(winPctForStandings(row.wins, row.losses), row.wins + row.losses);
    const targets = targetsBase.filter((p) =>
      profile === "contender" ? p.age >= 24 && p.overall >= 76 : profile === "rebuild" ? p.age <= 24 : true
    );
    if (targets.length === 0) continue;
    const target = targets[Math.floor(Math.random() * targets.length)];

    // Ce que l'IA peut céder : pas ses 2 meilleurs ; une équipe en
    // reconstruction cède d'abord ses vétérans, un prétendant ses jeunes et
    // ses picks.
    const aiRoster = (byTeam.get(row.teamId) ?? []).sort((a, b) => b.value - a.value);
    const playerAssets: Asset[] = aiRoster
      .slice(2)
      .filter((p) => !p.injured && p.value > 0)
      .filter((p) => (profile === "rebuild" ? p.age >= 26 : true))
      .slice(0, 12)
      .map((p) => ({ kind: "player", id: p.id, value: p.value, salary: p.salary, label: p.label, age: p.age }));
    const pickAssets: Asset[] =
      profile === "rebuild"
        ? []
        : picks
            .filter((p) => p.teamId === row.teamId)
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

    const [aiPayroll, aiSize] = await Promise.all([getPayrollForTeam(careerId, row.teamId), rosterSize(row.teamId)]);
    const combos: Asset[][] = [];
    for (let i = 0; i < playerAssets.length; i++) {
      combos.push([playerAssets[i]]);
      for (let j = i + 1; j < playerAssets.length; j++) combos.push([playerAssets[i], playerAssets[j]]);
    }
    for (const base of [...combos]) for (const pick of pickAssets) combos.push([...base, pick]);

    const valid: { assets: Asset[]; gap: number }[] = [];
    for (const assets of combos) {
      const given = assets.reduce((s, a) => s + a.value, 0);
      if (given < target.value * MIN_GIVE_RATIO || given > target.value * MAX_GIVE_RATIO) continue;
      const players = assets.filter((a) => a.kind === "player");
      const salaryOut = players.reduce((s, a) => s + a.salary, 0);
      const capOk =
        checkTradeSide(leagueId, salaryCap, aiPayroll, salaryOut, target.salary).ok &&
        checkTradeSide(leagueId, salaryCap, humanPayroll, target.salary, salaryOut).ok;
      if (!capOk) continue;
      const newHuman = humanSize - 1 + players.length;
      const newAi = aiSize - players.length + 1;
      if ((newHuman > maxRoster && newHuman > humanSize) || (newAi < minRoster && newAi < aiSize)) continue;
      const gap = Math.abs(given - target.value * 0.98) + players.length * 5;
      valid.push({ assets, gap });
    }
    // Un peu de variété : l'un des 3 meilleurs paquets, pas toujours le même.
    if (valid.length > 0) {
      const top = valid.sort((a, b) => a.gap - b.gap).slice(0, 3);
      return { aiTeamId: row.teamId, target, assets: top[Math.floor(Math.random() * top.length)].assets };
    }
  }
  return null;
}

// Appelée après les lots de matchs : pour chaque GM humain, de temps en
// temps, une équipe IA propose un échange (offre en attente dans la page
// Échanges, message dans la boîte de réception ; « Continuer » s'arrête).
export async function maybeAiTradeOffers(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  if (!isRegularSeason(season)) return;
  const memberships = await prisma.membership.findMany({ where: { careerId }, select: { teamId: true } });
  if (memberships.length === 0) return;
  const [lastPlayed, deadlinePassed] = await Promise.all([
    prisma.game.findFirst({ where: { careerId, season, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    isTradeDeadlinePassed(careerId, season),
  ]);
  if (!lastPlayed || deadlinePassed) return;
  const today = lastPlayed.gameDate;
  const humanTeamIds = new Set(memberships.map((m) => m.teamId));

  for (const { teamId } of memberships) {
    const state = await getOrCreateTeamState(careerId, teamId, leagueId);
    if (state.lastAiTradeOfferAt && (today.getTime() - state.lastAiTradeOfferAt.getTime()) / 86_400_000 < OFFER_COOLDOWN_DAYS) {
      continue;
    }
    await prisma.teamState.update({ where: { id: state.id }, data: { lastAiTradeOfferAt: today } });
    const pendingFromAi = await prisma.tradeOffer.count({
      where: { careerId, toTeamId: teamId, status: "pending", fromTeamId: { notIn: [...humanTeamIds] } },
    });
    if (pendingFromAi > 0 || Math.random() >= OFFER_CHANCE) continue;

    const offer = await buildOffer(careerId, leagueId, season, teamId, humanTeamIds, locale);
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

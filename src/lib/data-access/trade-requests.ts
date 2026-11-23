import "server-only";
import { parsePlan, projectDef } from "@/lib/careers/facility-projects-rules";
import { ambitiousWantsOut, personalityFor, scaleMoraleDelta, tradeRequestChanceMultiplier } from "@/lib/careers/personality-rules";
import { clampMorale } from "@/lib/careers/morale-rules";
import { aiStartProject } from "@/lib/data-access/ai-facilities";
import { translatorFor } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { tradeRequestMessageText } from "@/lib/careers/inbox-rules";
import type { Locale } from "@/lib/i18n/locale";
import type { StandingsRow } from "@/lib/types";
import type { TeamState } from "@prisma/client";
import {
  ATTRACTIVE_FACILITIES_THRESHOLD,
  ATTRACTIVE_TRAINING_STAFF_THRESHOLD,
  COMPETITIVE_WIN_PCT_THRESHOLD,
  TEAM_TRADE_REQUEST_COOLDOWN_DAYS,
  TRADE_REQUEST_CHANCE,
  TRADE_REQUEST_CHECK_COOLDOWN_DAYS,
  TRADE_REQUEST_MIN_GAMES_PLAYED,
  tradeRequestReasons,
  winPctForStandings,
  type TradeRequestReason,
} from "@/lib/careers/player-demands";
import type { PromiseType } from "@/lib/careers/promise-rules";

// Appelée une fois par équipe humaine juste après la résolution d'un match —
// même principe que maybeCreatePressConference (src/lib/data-access/press.ts) :
// double cooldown (par joueuse ET anti-cluster par équipe) puis tirage au
// sort, plutôt que la recherche "toujours vraie" d'avant qui rendait TOUTE
// joueuse star insatisfaite en permanence dès le premier match.
export async function maybeFlagTradeRequest(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  gameDate: Date,
  locale: Locale,
  ai = false // équipe gérée par l'IA : pas de message, l'IA répond elle-même
): Promise<void> {
  const teamState = await getOrCreateTeamState(careerId, teamId, leagueId);

  if (teamState.lastTradeRequestDate) {
    const diffDays = (gameDate.getTime() - teamState.lastTradeRequestDate.getTime()) / 86_400_000;
    if (diffDays < TEAM_TRADE_REQUEST_COOLDOWN_DAYS) return;
  }

  const standings = await getStandings(careerId, leagueId, season);
  const row = standings.find((s) => s.teamId === teamId);
  const gamesPlayed = (row?.wins ?? 0) + (row?.losses ?? 0);
  if (gamesPlayed < TRADE_REQUEST_MIN_GAMES_PLAYED) return;

  const team = await getTeamById(teamId);
  if (!team) return;
  const teamWinPct = winPctForStandings(row?.wins ?? 0, row?.losses ?? 0);

  const contracts = await prisma.contract.findMany({
    where: { careerId, teamId },
    select: { playerId: true },
  });
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) }, retired: false },
    include: { player: { select: { firstName: true, lastName: true } } },
  });

  for (const state of states) {
    if (state.wantsTrade || state.activePromiseType) continue;
    if (state.lastTradeRequestCheckDate) {
      const diffDays = (gameDate.getTime() - state.lastTradeRequestCheckDate.getTime()) / 86_400_000;
      if (diffDays < TRADE_REQUEST_CHECK_COOLDOWN_DAYS) continue;
    }
    const reasons = tradeRequestReasons({
      renown: state.renown,
      age: state.age,
      teamWinPct,
      teamMarketAppeal: team.marketAppeal,
      teamFacilitiesLevel: teamState.facilitiesLevel,
      morale: state.morale,
    });
    // Personnalité : un ambitieux ne supporte pas de perdre, même sans être
    // une star ; un joueur fidèle le demande moins souvent.
    const personality = personalityFor(state.playerId, state.age);
    if (ambitiousWantsOut(personality, teamWinPct) && !reasons.includes("competitiveness")) reasons.push("competitiveness");
    const chance = TRADE_REQUEST_CHANCE * tradeRequestChanceMultiplier(personality);
    if (reasons.length === 0 || Math.random() >= chance) continue;

    await prisma.$transaction([
      prisma.playerState.update({
        where: { id: state.id },
        data: {
          wantsTrade: true,
          tradeRequestReasonsJson: JSON.stringify(reasons),
          tradeRequestSinceSeason: season,
          lastTradeRequestCheckDate: gameDate,
        },
      }),
      prisma.teamState.update({
        where: { id: teamState.id },
        data: { lastTradeRequestDate: gameDate },
      }),
    ]);

    const playerName = `${state.player.firstName} ${state.player.lastName}`;
    if (ai) {
      await aiRespondToTradeRequest({ careerId, teamId, leagueId, season, gameDate, locale, state, reasons, playerName, teamName: `${team.city} ${team.name}` });
      break;
    }
    const { title, body } = tradeRequestMessageText(locale, playerName);
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "trade_request",
      title,
      body,
      `/teams/${teamId}/players/${state.playerId}`,
      { gameDate, playerId: state.playerId }
    );
    break; // une seule nouvelle demande par appel — garantit l'anti-cluster même si plusieurs joueuses sont éligibles le même match
  }
}

// Équipe IA : réponse immédiate à une demande d'échange.
// - installations en cause : chantier au centre d'entraînement + promesse ;
// - moral seul : une discussion le convainc une fois sur deux ;
// - sinon (compétitivité, marché) : promesse d'échange (réalisé ensuite par
//   l'IA, voir ai-trades.ts), ou rien.
// Les stars font l'actualité de la ligue.
export async function aiRespondToTradeRequest(p: {
  careerId: string;
  teamId: string;
  leagueId: string;
  season: string;
  gameDate: Date;
  locale: Locale;
  state: { id: string; playerId: string; renown: number; morale: number; age: number };
  reasons: string[];
  playerName: string;
  teamName: string;
}): Promise<void> {
  const base = p.season.slice(0, 9);
  let response: "facilities" | "convinced" | "trade" | "none" = "none";
  if (p.reasons.includes("facilities")) {
    const key = await aiStartProject(p.careerId, p.teamId, p.leagueId, base, p.gameDate, p.locale, {
      preferDomain: "training",
      forPlayer: p.playerName,
    });
    if (key) response = "facilities";
  }
  if (response === "none" && p.reasons.length === 1 && p.reasons[0] === "morale" && Math.random() < 0.5) response = "convinced";
  if (response === "none" && Math.random() < 0.7) response = "trade";

  if (response === "facilities" || response === "trade") {
    await prisma.playerState.update({
      where: { id: p.state.id },
      data: { activePromiseType: response, activePromiseSeason: base, promiseOriginTeamId: p.teamId },
    });
  } else if (response === "convinced") {
    await prisma.playerState.update({
      where: { id: p.state.id },
      data: {
        wantsTrade: false,
        tradeRequestReasonsJson: null,
        tradeRequestSinceSeason: null,
        morale: clampMorale(p.state.morale + scaleMoraleDelta(4, personalityFor(p.state.playerId, p.state.age))),
      },
    });
  }
  if (p.state.renown >= 75) {
    const t = translatorFor(p.locale);
    await prisma.leagueNews.create({
      data: {
        careerId: p.careerId,
        season: base,
        type: "locker",
        teamId: p.teamId,
        title: t("aiLife.news.requestTitle", { player: p.playerName, team: p.teamName }),
        body: t(`aiLife.news.response.${response}` as DictionaryKey, { player: p.playerName, team: p.teamName }),
      },
    });
  }
}

export interface PlayerDemandState {
  wantsTrade: boolean;
  reasons: TradeRequestReason[];
  sinceSeason: string | null;
  activePromiseType: PromiseType | null;
  activePromiseSeason: string | null;
}

function toDemandState(state: {
  wantsTrade: boolean;
  tradeRequestReasonsJson: string | null;
  tradeRequestSinceSeason: string | null;
  activePromiseType: string | null;
  activePromiseSeason: string | null;
}): PlayerDemandState {
  return {
    wantsTrade: state.wantsTrade,
    reasons: state.tradeRequestReasonsJson
      ? (JSON.parse(state.tradeRequestReasonsJson) as TradeRequestReason[])
      : [],
    sinceSeason: state.tradeRequestSinceSeason,
    activePromiseType: state.activePromiseType as PromiseType | null,
    activePromiseSeason: state.activePromiseSeason,
  };
}

export async function getPlayerDemandState(
  careerId: string,
  playerId: string
): Promise<PlayerDemandState | null> {
  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId, playerId } },
  });
  return state ? toDemandState(state) : null;
}

export async function getPlayerDemandStates(
  careerId: string,
  playerIds: string[]
): Promise<Map<string, PlayerDemandState>> {
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: playerIds } },
  });
  return new Map(states.map((state) => [state.playerId, toDemandState(state)]));
}

// Promesse déjà tenue ? Prolongation signée, échange réalisé, ou chantier
// du centre d'entraînement lancé dans la saison (ou niveau suffisant). La
// compétitivité, elle, ne se juge qu'au bilan final.
async function promiseHonoredNow(
  careerId: string,
  state: { playerId: string; activePromiseType: string | null; promiseOriginTeamId: string | null },
  season: string,
  contract: { teamId: string; lastExtendedSeason: string | null },
  ts: Pick<TeamState, "facilitiesLevel" | "trainingStaffLevel" | "facilityProjectsJson"> | undefined
): Promise<boolean> {
  switch (state.activePromiseType as PromiseType) {
    case "renewal":
      return contract.lastExtendedSeason === season;
    case "trade":
      return Boolean(
        await prisma.playerTeamStint.findFirst({
          where: {
            careerId,
            playerId: state.playerId,
            season,
            reason: "traded",
            teamId: { not: state.promiseOriginTeamId ?? undefined },
          },
        })
      );
    case "facilities": {
      const from = new Date(`${season.slice(0, 4)}-07-01T00:00:00Z`).getTime();
      const to = new Date(`${season.slice(5, 9)}-07-01T00:00:00Z`).getTime();
      const invested = parsePlan(ts?.facilityProjectsJson).projects.some((p) => {
        const at = new Date(p.startedOn).getTime();
        return projectDef(p.key)?.domain === "training" && at >= from && at < to;
      });
      return (
        invested ||
        ((ts?.facilitiesLevel ?? 0) >= ATTRACTIVE_FACILITIES_THRESHOLD &&
          (ts?.trainingStaffLevel ?? 0) >= ATTRACTIVE_TRAINING_STAFF_THRESHOLD)
      );
    }
    default:
      return false;
  }
}

export const PROMISE_HONORED_MORALE = 6;

// Date du jeu (dernier match joué), pour dater les messages hors simulation.
export async function currentGameDate(careerId: string): Promise<Date> {
  const last = await prisma.game.findFirst({ where: { careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } });
  return last?.gameDate ?? new Date();
}

// En cours de saison (après chaque match d'une équipe humaine) : une
// promesse tenue est soldée tout de suite — le joueur est satisfait, son
// moral remonte et sa demande d'échange retombe — sans attendre le bilan.
export async function resolveHonoredPromises(
  careerId: string,
  teamId: string,
  seasonLabel: string,
  gameDate: Date,
  locale: Locale
): Promise<number> {
  const season = seasonLabel.slice(0, 9);
  const pending = await prisma.playerState.findMany({
    where: {
      careerId,
      activePromiseType: { in: ["renewal", "trade", "facilities"] },
      activePromiseSeason: season,
      promiseOriginTeamId: teamId,
    },
    include: { player: { select: { firstName: true, lastName: true } } },
  });
  if (pending.length === 0) return 0;
  const [ts, membership] = await Promise.all([
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
    prisma.membership.findUnique({ where: { careerId_teamId: { careerId, teamId } }, select: { id: true } }),
  ]);
  const human = !!membership;
  const fr = locale === "fr";
  let resolved = 0;
  for (const state of pending) {
    const contract = await prisma.contract.findUnique({ where: { careerId_playerId: { careerId, playerId: state.playerId } } });
    if (!contract || state.retired) continue;
    if (!(await promiseHonoredNow(careerId, state, season, contract, ts ?? undefined))) continue;
    const type = state.activePromiseType as PromiseType;
    const stays = type !== "trade";
    const p = personalityFor(state.playerId, state.age);
    const updated = await prisma.playerState.updateMany({
      where: { id: state.id, activePromiseType: state.activePromiseType },
      data: {
        activePromiseType: null,
        activePromiseSeason: null,
        promiseOriginTeamId: null,
        wantsTrade: false,
        tradeRequestReasonsJson: null,
        tradeRequestSinceSeason: null,
        lastTradeRequestCheckDate: gameDate,
        ...(stays ? { morale: clampMorale(state.morale + scaleMoraleDelta(PROMISE_HONORED_MORALE, p)) } : {}),
      },
    });
    if (updated.count === 0) continue;
    resolved++;
    const name = `${state.player.firstName} ${state.player.lastName}`;
    const text: Record<string, [string, string, string, string]> = {
      renewal: [
        `Promesse tenue : ${name} prolongé`,
        `Comme promis, ${name} a été prolongé. Il est satisfait, ne demande plus à partir et son moral remonte.`,
        `Promise kept: ${name} extended`,
        `As promised, ${name} has been extended. He's satisfied, no longer wants out and his morale rises.`,
      ],
      facilities: [
        `Promesse tenue : ${name} voit le club investir`,
        `Le club investit dans son centre d'entraînement comme promis. ${name} est rassuré, ne demande plus à partir et son moral remonte.`,
        `Promise kept: ${name} sees the club invest`,
        `The club is investing in its training center as promised. ${name} is reassured, no longer wants out and his morale rises.`,
      ],
      trade: [
        `Promesse tenue : ${name} échangé`,
        `Comme promis, ${name} a été échangé. Il quitte le club en bons termes.`,
        `Promise kept: ${name} traded`,
        `As promised, ${name} has been traded. He leaves on good terms.`,
      ],
    };
    const [tfr, bfr, ten, ben] = text[type];
    if (!human) {
      // Équipe IA : l'actualité de la ligue en parle pour les stars.
      if (state.renown >= 75) {
        await prisma.leagueNews.create({
          data: { careerId, season, type: "locker", teamId, title: fr ? tfr : ten, body: fr ? bfr : ben },
        });
      }
      continue;
    }
    await createInboxMessage(careerId, teamId, season, "player_reaction", fr ? tfr : ten, fr ? bfr : ben, `/teams/${contract.teamId}/players/${state.playerId}`, {
      gameDate,
      playerId: state.playerId,
      priority: "important",
    });
  }
  return resolved;
}

// Résolution des promesses en attente pour la saison qui vient de se
// terminer — appelée depuis advanceSeason AVANT l'écrasement de
// career.season, avec finishedStandings/teamStates déjà capturés pour cette
// saison (teamStates avant la dégradation annuelle des infrastructures).
// Qu'elle soit honorée ou rompue, la promesse ET wantsTrade sont remis à
// zéro dans tous les cas (avec un nouveau timestamp de cooldown, pour une
// grâce en début de saison suivante plutôt qu'un re-déclenchement
// instantané) — seul le compteur honored/broken retourné distingue les deux
// issues, à des fins d'affichage éventuel.
export async function evaluatePendingPromises(
  careerId: string,
  finishedSeason: string,
  finishedStandings: StandingsRow[],
  teamStates: TeamState[]
): Promise<{ honored: number; broken: number }> {
  const pending = await prisma.playerState.findMany({
    where: { careerId, activePromiseType: { not: null }, activePromiseSeason: finishedSeason },
  });

  let honored = 0;
  let broken = 0;

  for (const state of pending) {
    const contract = await prisma.contract.findUnique({
      where: { careerId_playerId: { careerId, playerId: state.playerId } },
    });
    const teamId = contract?.teamId ?? state.promiseOriginTeamId ?? "";
    let isHonored = false;

    if (contract && !state.retired) {
      switch (state.activePromiseType as PromiseType) {
        case "renewal":
        case "trade":
        case "facilities":
          isHonored = await promiseHonoredNow(careerId, state, finishedSeason, contract, teamStates.find((x) => x.teamId === teamId));
          break;
        case "competitiveness": {
          const row = finishedStandings.find((s) => s.teamId === teamId);
          isHonored =
            winPctForStandings(row?.wins ?? 0, row?.losses ?? 0) >= COMPETITIVE_WIN_PCT_THRESHOLD;
          break;
        }
      }
    }

    if (isHonored) honored++;
    else broken++;

    await prisma.playerState.update({
      where: { id: state.id },
      data: {
        activePromiseType: null,
        activePromiseSeason: null,
        promiseOriginTeamId: null,
        wantsTrade: false,
        tradeRequestReasonsJson: null,
        tradeRequestSinceSeason: null,
        lastTradeRequestCheckDate: new Date(),
      },
    });
  }

  return { honored, broken };
}

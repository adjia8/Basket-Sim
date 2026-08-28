import "server-only";
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
  locale: Locale
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
    });
    if (reasons.length === 0 || Math.random() >= TRADE_REQUEST_CHANCE) continue;

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
    const { title, body } = tradeRequestMessageText(locale, playerName);
    await createInboxMessage(careerId, teamId, season, "trade_request", title, body, `/teams/${teamId}`);
    break; // une seule nouvelle demande par appel — garantit l'anti-cluster même si plusieurs joueuses sont éligibles le même match
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
          isHonored = contract.lastExtendedSeason === finishedSeason;
          break;
        case "trade":
          isHonored = Boolean(
            await prisma.playerTeamStint.findFirst({
              where: {
                careerId,
                playerId: state.playerId,
                season: finishedSeason,
                reason: "traded",
                teamId: { not: state.promiseOriginTeamId ?? undefined },
              },
            })
          );
          break;
        case "facilities": {
          const ts = teamStates.find((s) => s.teamId === teamId);
          isHonored =
            (ts?.facilitiesLevel ?? 0) >= ATTRACTIVE_FACILITIES_THRESHOLD &&
            (ts?.trainingStaffLevel ?? 0) >= ATTRACTIVE_TRAINING_STAFF_THRESHOLD;
          break;
        }
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

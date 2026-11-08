import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import {
  bestTactics,
  counterTactics,
  defenseFit,
  depthFit,
  matchupEdge,
  offenseFit,
  paceFit,
  parseTactics,
  tacticalEdge,
  DEFENSE_SCHEMES,
  OFFENSE_STYLES,
  PACES,
  ROTATION_DEPTHS,
  type Tactics,
} from "@/lib/careers/tactics-rules";

// Rotation estimée : les 10 meilleurs joueurs disponibles.
function availableRotation(roster: Player[]): Player[] {
  return roster
    .filter((p) => !p.injured && !p.restNextGame)
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 10);
}

// Tactique effective d'une équipe : celle du GM humain, sinon celle que
// l'IA choisira (la mieux adaptée à son effectif, comme en match).
export async function getTeamTactics(
  careerId: string,
  teamId: string,
  leagueId: string
): Promise<{ tactics: Tactics; isAi: boolean; rotation: Player[] }> {
  const [roster, state, manager] = await Promise.all([
    getRosterForTeam(careerId, teamId),
    getOrCreateTeamState(careerId, teamId, leagueId),
    getMembershipForTeam(careerId, teamId),
  ]);
  const rotation = availableRotation(roster);
  return manager
    ? { tactics: parseTactics(state.tacticsJson), isAi: false, rotation }
    : { tactics: bestTactics(rotation), isAi: true, rotation };
}

export interface OptionFit {
  value: string;
  fit: number; // points par match (adéquation à l'effectif)
  duel?: number; // points par match face au prochain adversaire
}

export interface TacticsReport {
  current: Tactics;
  suggestion: Tactics; // la mieux adaptée à l'effectif
  counter: Tactics | null; // contre le prochain adversaire
  fits: { pace: OptionFit[]; offense: OptionFit[]; defense: OptionFit[]; depth: OptionFit[] };
  coachTactics: number;
  opponent: { teamId: string; tactics: Tactics; gameId: string; isAi: boolean } | null;
  edgeCurrent: number | null; // avantage estimé face au prochain adversaire, tactique actuelle
  edgeCounter: number | null; // … avec la contre-tactique
}

// `opponentIdOverride` : adversaire d'un match précis (page de match) ; sinon
// le prochain adversaire au calendrier.
export async function getTacticsReport(
  careerId: string,
  teamId: string,
  leagueId: string,
  opponentIdOverride?: string
): Promise<TacticsReport> {
  const [mine, nextGame, profiles] = await Promise.all([
    getTeamTactics(careerId, teamId, leagueId),
    prisma.game.findFirst({
      where: { careerId, status: { not: "final" }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      orderBy: { gameDate: "asc" },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    }),
    getStaffProfiles(careerId, [teamId], leagueId),
  ]);
  const coachTactics = (profiles.get(teamId) ?? NEUTRAL_STAFF_PROFILE).tactics;
  const opponentId =
    opponentIdOverride ?? (nextGame ? (nextGame.homeTeamId === teamId ? nextGame.awayTeamId : nextGame.homeTeamId) : null);
  const opp = opponentId ? await getTeamTactics(careerId, opponentId, leagueId) : null;
  const r = mine.rotation;

  const fits = {
    pace: PACES.map((v) => ({ value: v, fit: paceFit(r, v, opp?.rotation) })),
    offense: OFFENSE_STYLES.map((v) => ({
      value: v,
      fit: offenseFit(r, v),
      duel: opp ? matchupEdge(v, opp.tactics.defense) : undefined,
    })),
    defense: DEFENSE_SCHEMES.map((v) => ({
      value: v,
      fit: defenseFit(r, v),
      duel: opp ? -matchupEdge(opp.tactics.offense, v) : undefined,
    })),
    depth: ROTATION_DEPTHS.map((v) => ({ value: v, fit: depthFit(r, v) })),
  };
  const counter = opp ? counterTactics(r, opp.tactics) : null;
  const edge = (t: Tactics) =>
    opp ? tacticalEdge({ rotation: r, tactics: t, coachTactics }, { rotation: opp.rotation, tactics: opp.tactics }).total : null;

  return {
    current: mine.tactics,
    suggestion: bestTactics(r),
    counter,
    fits,
    coachTactics,
    opponent: opp && opponentId ? { teamId: opponentId, tactics: opp.tactics, gameId: nextGame?.id ?? "", isAi: opp.isAi } : null,
    edgeCurrent: edge(mine.tactics),
    edgeCounter: counter ? edge(counter) : null,
  };
}

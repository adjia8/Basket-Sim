import "server-only";
import { prisma } from "@/lib/prisma";
import { parseTactics } from "@/lib/careers/tactics-rules";
import {
  attributeEvolution,
  clubStanding,
  gmRating,
  gmSalary,
  HIRE_CONTRACT_YEARS,
  parseLifestyle,
  prestigeOf,
  type GmPoints,
  type SeasonStyle,
  type StandingParts,
} from "@/lib/careers/gm-career-rules";
import type { GmSeasonOutcome } from "@/lib/careers/gm-rules";
import type { StandingsRow } from "@/lib/types";

// Carrière du GM : contrat, image au club, projection de l'évolution de
// ses compétences — voir gm-career-rules.ts.

type GmRow = {
  id: string;
  offensePoints: number;
  defensePoints: number;
  physicalPoints: number;
  tacticalPoints: number;
  chemistryPoints: number;
  reputation: number;
  mediaRelation: number;
  frontOfficeApproval: number;
  contractSalary: number;
  contractYears: number;
  lifestyleJson: string | null;
};

export const pointsOf = (gm: GmRow): GmPoints => ({
  offense: gm.offensePoints,
  defense: gm.defensePoints,
  physical: gm.physicalPoints,
  tactical: gm.tacticalPoints,
  chemistry: gm.chemistryPoints,
});

// Contrat initial (GM créés avant les contrats, ou nouvelle embauche).
export async function ensureGmContract(gm: GmRow, leagueId: string, teamId: string): Promise<{ salary: number; years: number }> {
  if (gm.contractSalary > 0) return { salary: gm.contractSalary, years: gm.contractYears };
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { marketAppeal: true } });
  const salary = gmSalary(leagueId, team?.marketAppeal ?? 50, gm.reputation);
  await prisma.gmProfile.update({ where: { id: gm.id }, data: { contractSalary: salary, contractYears: HIRE_CONTRACT_YEARS } });
  return { salary, years: HIRE_CONTRACT_YEARS };
}

// Classements attaque / défense d'une équipe d'après le classement.
export function styleRanks(standings: StandingsRow[], teamId: string): { offenseRank: number; defenseRank: number; teams: number } {
  const played = standings.filter((r) => r.wins + r.losses > 0);
  const rows = played.length > 0 ? played : standings;
  const per = (r: StandingsRow, v: number) => v / Math.max(1, r.wins + r.losses);
  const me = rows.find((r) => r.teamId === teamId);
  if (!me) return { offenseRank: Math.ceil(rows.length / 2), defenseRank: Math.ceil(rows.length / 2), teams: Math.max(1, rows.length) };
  const myOff = per(me, me.pointsFor);
  const myDef = per(me, me.pointsAgainst);
  return {
    offenseRank: rows.filter((r) => per(r, r.pointsFor) > myOff).length + 1,
    defenseRank: rows.filter((r) => per(r, r.pointsAgainst) < myDef).length + 1,
    teams: rows.length,
  };
}

// Style de la saison d'une équipe (classements, cohésion, tactique).
export async function seasonStyle(
  careerId: string,
  teamId: string,
  standings: StandingsRow[],
  outcome: GmSeasonOutcome | null
): Promise<SeasonStyle> {
  const state = await prisma.teamState.findFirst({ where: { careerId, teamId }, select: { chemistry: true, tacticsJson: true } });
  const tactics = parseTactics(state?.tacticsJson);
  return {
    ...styleRanks(standings, teamId),
    chemistry: state?.chemistry ?? 50,
    pace: tactics.pace,
    offenseStyle: tactics.offense,
    defenseStyle: tactics.defense,
    outcome,
  };
}

// Image du GM au club (quatre publics).
export async function standingParts(careerId: string, teamId: string, gm: GmRow): Promise<StandingParts> {
  const [state, contracts] = await Promise.all([
    prisma.teamState.findFirst({ where: { careerId, teamId }, select: { publicOpinion: true } }),
    prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } }),
  ]);
  const morale = await prisma.playerState.aggregate({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
    _avg: { morale: true },
  });
  return {
    board: gm.frontOfficeApproval,
    players: Math.round(morale._avg.morale ?? 50),
    press: gm.mediaRelation,
    fans: state?.publicOpinion ?? 50,
  };
}

export interface GmCareerView {
  rating: number;
  points: GmPoints;
  projection: Record<keyof GmPoints, number>; // évolution prévue si la saison finissait aujourd'hui
  parts: StandingParts;
  standing: number;
  reputation: number;
  prestige: number;
}

export async function getGmCareerView(careerId: string, teamId: string, gm: GmRow, standings: StandingsRow[]): Promise<GmCareerView> {
  const points = pointsOf(gm);
  const [style, parts] = await Promise.all([seasonStyle(careerId, teamId, standings, null), standingParts(careerId, teamId, gm)]);
  // Pas encore de match : pas de tendance.
  const played = standings.some((r) => r.teamId === teamId && r.wins + r.losses > 0);
  return {
    rating: gmRating(points),
    points,
    projection: played ? attributeEvolution(points, style) : { offense: 0, defense: 0, physical: 0, tactical: 0, chemistry: 0 },
    parts,
    standing: clubStanding(parts),
    reputation: gm.reputation,
    prestige: prestigeOf(parseLifestyle(gm.lifestyleJson)),
  };
}

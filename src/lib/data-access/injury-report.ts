import "server-only";
import { prisma } from "@/lib/prisma";
import { estimatedReturn, injuryTier, sortInjured, type InjuryTier } from "@/lib/careers/injury-report-rules";

export interface InjuredPlayerView {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAbbr: string;
  injuryType: string | null;
  severity: string | null;
  gamesRemaining: number;
  playingThrough: boolean;
  returnProtocol: string | null;
  overall: number;
  renown: number;
  tier: InjuryTier;
  returnDate: string | null; // ISO, match du retour estimé
}

// Tous les blessés de la ligue (toutes équipes), du plus important au moins
// important (voir injury-report-rules.ts), avec leur date de retour estimée
// d'après le calendrier de leur équipe.
export async function getLeagueInjuries(careerId: string, leagueId: string): Promise<InjuredPlayerView[]> {
  const states = await prisma.playerState.findMany({
    where: { careerId, injured: true, retired: false },
    select: {
      playerId: true,
      injuryType: true,
      injurySeverity: true,
      injuryGamesRemaining: true,
      playingThroughInjury: true,
      returnProtocol: true,
      overallRating: true,
      renown: true,
      player: { select: { firstName: true, lastName: true } },
    },
  });
  if (states.length === 0) return [];
  const contracts = await prisma.contract.findMany({
    where: { careerId, playerId: { in: states.map((s) => s.playerId) } },
    select: { playerId: true, teamId: true, team: { select: { city: true, name: true, abbreviation: true, leagueId: true } } },
  });
  const contractByPlayer = new Map(contracts.filter((c) => c.team.leagueId === leagueId).map((c) => [c.playerId, c]));
  const teamIds = [...new Set([...contractByPlayer.values()].map((c) => c.teamId))];
  const upcoming = await prisma.game.findMany({
    where: {
      careerId,
      status: { not: "final" },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    orderBy: { gameDate: "asc" },
    select: { homeTeamId: true, awayTeamId: true, gameDate: true },
  });
  const datesByTeam = new Map<string, string[]>();
  for (const g of upcoming) {
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      if (!teamIds.includes(id)) continue;
      datesByTeam.set(id, [...(datesByTeam.get(id) ?? []), g.gameDate.toISOString()]);
    }
  }

  const list: InjuredPlayerView[] = [];
  for (const s of states) {
    const c = contractByPlayer.get(s.playerId);
    if (!c) continue; // agent libre blessé : hors effectif
    list.push({
      playerId: s.playerId,
      name: `${s.player.firstName} ${s.player.lastName}`,
      teamId: c.teamId,
      teamName: `${c.team.city} ${c.team.name}`,
      teamAbbr: c.team.abbreviation,
      injuryType: s.injuryType,
      severity: s.injurySeverity,
      gamesRemaining: s.injuryGamesRemaining,
      playingThrough: s.playingThroughInjury,
      returnProtocol: s.returnProtocol,
      overall: s.overallRating,
      renown: s.renown,
      tier: injuryTier(s.overallRating, s.renown),
      returnDate: estimatedReturn(datesByTeam.get(c.teamId) ?? [], s.injuryGamesRemaining),
    });
  }
  return sortInjured(list);
}

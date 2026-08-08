import "server-only";
import { prisma } from "@/lib/prisma";

export type TeamStintReason = "drafted" | "signed" | "traded";

export interface PlayerTeamStintRow {
  id: string;
  teamId: string;
  teamCity: string;
  teamName: string;
  teamAbbreviation: string;
  season: string;
  reason: TeamStintReason;
}

// Alimenté à partir de la mise en place de cette table uniquement (voir
// draft.ts, roster.ts, trade.ts) — impossible de reconstruire le passé d'une
// Career déjà en cours.
export async function recordTeamStint(
  careerId: string,
  playerId: string,
  teamId: string,
  season: string,
  reason: TeamStintReason
): Promise<void> {
  await prisma.playerTeamStint.create({
    data: { careerId, playerId, teamId, season, reason },
  });
}

export async function getStintsForPlayer(
  careerId: string,
  playerId: string
): Promise<PlayerTeamStintRow[]> {
  const rows = await prisma.playerTeamStint.findMany({
    where: { careerId, playerId },
    include: { team: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    teamCity: row.team.city,
    teamName: row.team.name,
    teamAbbreviation: row.team.abbreviation,
    season: row.season,
    reason: row.reason as TeamStintReason,
  }));
}

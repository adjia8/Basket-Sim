import "server-only";
import { prisma } from "@/lib/prisma";
import { nextSeasonLabel } from "./season-format";

// Nombre de saisons futures toujours visibles/échangeables à l'avance, au-delà
// de la saison dont le draft est en cours — comme en vraie NBA où on peut
// échanger un pick plusieurs années avant qu'il n'existe vraiment.
export const FUTURE_PICK_WINDOW = 3;

// Crée les lignes "pick futur" (pickNumber non résolu) pour une saison et une
// liste d'équipes, une par tour, chaque équipe possédant par défaut son
// propre pick (teamId = originalTeamId) tant qu'aucun échange n'a eu lieu.
// Idempotent (skipDuplicates) : sûr à rappeler en filet de sécurité.
export async function createUnresolvedPicksForSeason(
  careerId: string,
  season: string,
  teamIds: string[]
): Promise<void> {
  const rows = teamIds.flatMap((teamId) =>
    [1, 2].map((round) => ({
      careerId,
      season,
      round,
      pickNumber: null,
      originalTeamId: teamId,
      teamId,
    }))
  );
  await prisma.draftPick.createMany({ data: rows, skipDuplicates: true });
}

// Les `count` saisons suivant `fromSeason`, dans l'ordre.
export function futureSeasonsAfter(fromSeason: string, count: number): string[] {
  const seasons: string[] = [];
  let season = fromSeason;
  for (let i = 0; i < count; i++) {
    season = nextSeasonLabel(season);
    seasons.push(season);
  }
  return seasons;
}

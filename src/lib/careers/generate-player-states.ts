import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";

// Générés pour TOUS les joueurs de la ligue (pas que ceux sous contrat) : les
// agents libres doivent aussi vieillir dans cette Career.
export async function generateCareerPlayerStates(
  careerId: string,
  players: Player[]
): Promise<void> {
  const rows = players.map((player) => ({
    careerId,
    playerId: player.id,
    age: player.age,
    overallRating: player.overallRating,
    scoring: player.ratings.scoring,
    playmaking: player.ratings.playmaking,
    rebounding: player.ratings.rebounding,
    defense: player.ratings.defense,
    athleticism: player.ratings.athleticism,
    retired: false,
  }));

  await prisma.playerState.createMany({ data: rows });
}

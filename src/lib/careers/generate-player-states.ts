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
    scoringInside: player.ratings.scoringInside,
    scoringOutside: player.ratings.scoringOutside,
    playmaking: player.ratings.playmaking,
    defenseInside: player.ratings.defenseInside,
    defenseOutside: player.ratings.defenseOutside,
    rebounding: player.ratings.rebounding,
    athleticism: player.ratings.athleticism,
    basketballIQ: player.ratings.basketballIQ,
    clutch: player.ratings.clutch,
    stamina: player.ratings.stamina,
    retired: false,
    injured: false,
    injuryGamesRemaining: 0,
    renown: player.renown,
    fatigue: 0,
    peakOverallRating: player.overallRating,
    peakRenown: player.renown,
  }));

  await prisma.playerState.createMany({ data: rows });
}

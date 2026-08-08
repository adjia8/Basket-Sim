import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { rollInjuryDurationGames, rollsInjury } from "@/lib/careers/injury-rules";

// Appelé juste après la résolution d'un match : pour chaque joueur du roster
// des deux équipes, décompte l'indisponibilité en cours (guérison) ou tire
// une nouvelle blessure. Une ligne PlayerState existe toujours pour chaque
// joueur (créée à la Career), donc updateMany est sûr même si la ligne
// n'a pas encore été relue depuis.
export async function advanceRosterInjuries(
  careerId: string,
  roster: Player[]
): Promise<void> {
  for (const player of roster) {
    if (player.injured) {
      const remaining = player.injuryGamesRemaining - 1;
      await prisma.playerState.updateMany({
        where: { careerId, playerId: player.id },
        data:
          remaining > 0
            ? { injuryGamesRemaining: remaining }
            : { injured: false, injuryGamesRemaining: 0 },
      });
    } else if (rollsInjury(player.injuryRisk)) {
      await prisma.playerState.updateMany({
        where: { careerId, playerId: player.id },
        data: { injured: true, injuryGamesRemaining: rollInjuryDurationGames() },
      });
    }
  }
}

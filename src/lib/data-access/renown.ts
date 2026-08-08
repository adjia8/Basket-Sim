import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry, Player } from "@/lib/types";
import { renownDeltaForGame } from "@/lib/careers/renown-rules";

// Appelé juste après la résolution d'un match : pour chaque entrée du box
// score, ajuste le renommé du joueur selon sa performance relative à son
// overall actuel. `roster` sert à retrouver l'overall courant (état de
// Career, pas le catalogue figé) de chaque joueur qui a joué.
export async function advancePlayerRenown(
  careerId: string,
  boxScore: BoxScoreEntry[],
  roster: Player[]
): Promise<void> {
  const rosterById = new Map(roster.map((p) => [p.id, p]));

  for (const entry of boxScore) {
    const player = rosterById.get(entry.playerId);
    if (!player) continue;

    const delta = renownDeltaForGame(entry, player.overallRating);
    const newRenown = Math.max(0, Math.min(99, Math.round(player.renown + delta)));
    await prisma.playerState.updateMany({
      where: { careerId, playerId: player.id },
      data: { renown: newRenown },
    });
  }
}

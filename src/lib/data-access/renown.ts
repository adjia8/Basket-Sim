import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry, Player } from "@/lib/types";
import { BENCHED_RENOWN_DECAY_CHANCE, renownDeltaForGame } from "@/lib/careers/renown-rules";

// Appelé juste après la résolution d'un match, pour CHAQUE joueur éligible
// (dressé pour le match — voir canPlay dans simulate-game/route.ts, qui
// exclut déjà les blessés et les joueuses en développement bloquées) : celui
// qui a une entrée dans le box score voit son renommé ajusté selon sa
// performance (renownDeltaForGame) ; celui qui était éligible mais n'a
// finalement pas joué (hors rotation, banc profond) subit une lente érosion
// (BENCHED_RENOWN_DECAY) plutôt qu'un renommé figé indéfiniment. `roster`
// sert à retrouver l'overall/renommé courant (état de Career, pas le
// catalogue figé) de chaque joueur.
export async function advancePlayerRenown(
  careerId: string,
  boxScore: BoxScoreEntry[],
  eligibleRoster: Player[]
): Promise<void> {
  const entryByPlayerId = new Map(boxScore.map((e) => [e.playerId, e]));

  for (const player of eligibleRoster) {
    const entry = entryByPlayerId.get(player.id);
    const delta = entry
      ? renownDeltaForGame(entry, player.overallRating)
      : Math.random() < BENCHED_RENOWN_DECAY_CHANCE
        ? -1
        : 0;
    if (delta === 0) continue;
    const newRenown = Math.max(0, Math.min(99, Math.round(player.renown + delta)));
    await prisma.playerState.updateMany({
      where: { careerId, playerId: player.id },
      data: { renown: newRenown },
    });
  }
}

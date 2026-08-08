import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry, Player } from "@/lib/types";
import { fatigueGainForGame, fatigueRecoveryForRestDays } from "@/lib/careers/fatigue-rules";

// Jours de repos réels avant `currentGameDate`, fiables depuis la correction
// du générateur de calendrier (Phase A — plus de collisions same-day). Pas de
// match antérieur cette saison (tout premier match) : repos par défaut
// raisonnable de 3 jours (début de saison, pas de fatigue accumulée).
export async function getRestDays(
  careerId: string,
  teamId: string,
  season: string,
  currentGameDate: Date
): Promise<number> {
  const previous = await prisma.game.findFirst({
    where: {
      careerId,
      season,
      status: "final",
      gameDate: { lt: currentGameDate },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "desc" },
  });
  if (!previous) return 3;
  const diffMs = currentGameDate.getTime() - previous.gameDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Appelé juste après la résolution d'un match : récupère chaque joueur du
// roster complet selon les jours de repos réels avant ce match, puis ajoute
// le gain de fatigue pour ceux qui ont effectivement joué (présents au box
// score — un banc qui ne rentre jamais en rotation ne se fatigue pas).
export async function advanceRosterFatigue(
  careerId: string,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  restDays: number
): Promise<void> {
  const playedIds = new Set(boxScore.map((e) => e.playerId));

  for (const player of roster) {
    const recovered = fatigueRecoveryForRestDays(restDays, player.ratings.stamina);
    let newFatigue = Math.max(0, player.fatigue - recovered);
    if (playedIds.has(player.id)) {
      newFatigue += fatigueGainForGame(player.ratings.stamina);
    }
    newFatigue = Math.max(0, Math.min(99, newFatigue));

    await prisma.playerState.updateMany({
      where: { careerId, playerId: player.id },
      data: { fatigue: newFatigue },
    });
  }
}

import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlayerStatePatches } from "./player-state-patches";
import type { BoxScoreEntry, Player } from "@/lib/types";
import { fatigueGainForGame, fatigueRecoveryForRestDays } from "@/lib/careers/fatigue-rules";
import { clampWear, wearGainForGame, wearRecovery } from "@/lib/careers/wear-rules";
import type { TrainingIntensity } from "@/lib/careers/training-rules";

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
// roster complet selon les jours de repos réels avant ce match (moins vite
// s'il est usé), puis ajoute le gain de fatigue pour ceux qui ont
// effectivement joué (présents au box score — un banc qui ne rentre jamais
// en rotation ne se fatigue pas). Met aussi à jour l'usure : minutes
// jouées, back-to-back et intensité d'entraînement l'augmentent, le repos
// (jours sans match, match passé sur le banc ou au repos) la résorbe.
export async function advanceRosterFatigue(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  restDays: number,
  facilitiesLevel = 50,
  trainingFatigueDelta = 0,
  intensity: TrainingIntensity | null = null
): Promise<void> {
  const playedIds = new Set(boxScore.map((e) => e.playerId));
  const minutesById = new Map(boxScore.map((e) => [e.playerId, e.minutesPlayed]));

  for (const player of roster) {
    const wear = player.wear ?? 0;
    const minutes = minutesById.get(player.id) ?? 0;
    const newWear = clampWear(
      wear -
        wearRecovery(restDays, minutes === 0, facilitiesLevel, wear) +
        wearGainForGame(minutes, restDays, player.ratings.stamina, intensity)
    );
    const recovered = fatigueRecoveryForRestDays(restDays, player.ratings.stamina, facilitiesLevel, wear);
    let newFatigue = Math.max(0, player.fatigue - recovered);
    if (playedIds.has(player.id)) {
      newFatigue += fatigueGainForGame(player.ratings.stamina);
    }
    // L'entraînement a lieu entre les matchs, pour tout l'effectif (pas
    // seulement ceux qui ont joué ce match précis).
    newFatigue += trainingFatigueDelta;
    newFatigue = Math.max(0, Math.min(99, newFatigue));

    patches.set(player.id, { fatigue: newFatigue, wear: newWear });
  }
}

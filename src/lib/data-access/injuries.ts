import "server-only";
import { prisma } from "@/lib/prisma";
import type { BoxScoreEntry, Player } from "@/lib/types";
import {
  escalateSeverity,
  rollInjuryDurationGames,
  rollsInjury,
  rollsPlayThroughSetback,
  severityForDuration,
} from "@/lib/careers/injury-rules";
import {
  clampConditioning,
  CONDITIONING_RECOVERY_PER_GAME,
  CONDITIONING_RECOVERY_WHILE_PLAYING_HURT,
  conditioningDecayPerMissedGame,
  conditioningLossOnInjury,
} from "@/lib/careers/conditioning-rules";

// Appelé une fois par équipe juste après la résolution d'un match (pas les
// deux rosters concaténés : `facilitiesLevel` diffère d'une équipe à
// l'autre) : pour chaque joueur du roster, décompte l'indisponibilité en
// cours (guérison, repos ou jeu forcé sur blessure mineure) ou tire une
// nouvelle blessure — et ajuste le conditionnement physique dans tous les
// cas. `boxScore` sert à savoir qui a réellement joué ce match (nécessaire
// pour distinguer repos complet et jeu forcé malgré la blessure).
export async function advanceRosterInjuries(
  careerId: string,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  facilitiesLevel = 50
): Promise<void> {
  const playedIds = new Set(boxScore.map((e) => e.playerId));

  for (const player of roster) {
    if (player.injured) {
      const severity = player.injurySeverity ?? "minor";
      const playedThroughInjury = player.playingThroughInjury && playedIds.has(player.id);

      if (playedThroughInjury) {
        const outcome = rollsPlayThroughSetback(player.conditioning);

        if (outcome === "aggravation") {
          // La même blessure s'aggrave : durée prolongée, gravité relevée
          // d'un cran, choc de conditionnement partiel (la moitié d'une
          // nouvelle blessure de cette gravité).
          const extra = rollInjuryDurationGames();
          const newSeverity = escalateSeverity(severity);
          await prisma.playerState.updateMany({
            where: { careerId, playerId: player.id },
            data: {
              injuryGamesRemaining: player.injuryGamesRemaining + extra,
              injurySeverity: newSeverity,
              playingThroughInjury: newSeverity === "minor" ? player.playingThroughInjury : false,
              conditioning: clampConditioning(
                player.conditioning - conditioningLossOnInjury(newSeverity) / 2
              ),
            },
          });
        } else if (outcome === "reinjury") {
          // Une nouvelle blessure distincte, contractée en compensant,
          // remplace le décompte en cours.
          const duration = rollInjuryDurationGames();
          const newSeverity = severityForDuration(duration);
          await prisma.playerState.updateMany({
            where: { careerId, playerId: player.id },
            data: {
              injuryGamesRemaining: duration,
              injurySeverity: newSeverity,
              playingThroughInjury: false,
              conditioning: clampConditioning(player.conditioning - conditioningLossOnInjury(newSeverity)),
            },
          });
        } else {
          // Aucun incident ce match : décompte normal, récupération de
          // conditionnement réduite (jouer diminué guérit moins vite que le
          // repos complet).
          const remaining = player.injuryGamesRemaining - 1;
          const recovered = clampConditioning(
            player.conditioning + CONDITIONING_RECOVERY_WHILE_PLAYING_HURT
          );
          await prisma.playerState.updateMany({
            where: { careerId, playerId: player.id },
            data:
              remaining > 0
                ? { injuryGamesRemaining: remaining, conditioning: recovered }
                : {
                    injured: false,
                    injuryGamesRemaining: 0,
                    injurySeverity: null,
                    playingThroughInjury: false,
                    conditioning: recovered,
                  },
          });
        }
      } else {
        // Repos complet (n'a pas joué ce match) : décompte normal, légère
        // érosion de conditionnement tant qu'il reste hors des terrains.
        const remaining = player.injuryGamesRemaining - 1;
        const decayed = clampConditioning(
          player.conditioning - conditioningDecayPerMissedGame(severity)
        );
        await prisma.playerState.updateMany({
          where: { careerId, playerId: player.id },
          data:
            remaining > 0
              ? { injuryGamesRemaining: remaining, conditioning: decayed }
              : {
                  injured: false,
                  injuryGamesRemaining: 0,
                  injurySeverity: null,
                  playingThroughInjury: false,
                  conditioning: decayed,
                },
        });
      }
    } else if (rollsInjury(player.injuryRisk, facilitiesLevel)) {
      const duration = rollInjuryDurationGames();
      const severity = severityForDuration(duration);
      await prisma.playerState.updateMany({
        where: { careerId, playerId: player.id },
        data: {
          injured: true,
          injuryGamesRemaining: duration,
          injurySeverity: severity,
          conditioning: clampConditioning(player.conditioning - conditioningLossOnInjury(severity)),
        },
      });
    } else if (player.conditioning < 100) {
      await prisma.playerState.updateMany({
        where: { careerId, playerId: player.id },
        data: {
          conditioning: clampConditioning(player.conditioning + CONDITIONING_RECOVERY_PER_GAME),
        },
      });
    }
  }
}

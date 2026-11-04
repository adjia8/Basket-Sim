import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlayerStatePatches } from "./player-state-patches";
import type { BoxScoreEntry, Player } from "@/lib/types";
import {
  escalateSeverity,
  injuryChance,
  rollInjury,
  rollInjuryDurationGames,
  rollsPlayThroughSetback,
  type InjuryType,
} from "@/lib/careers/injury-rules";
import type { TrainingIntensity } from "@/lib/careers/training-rules";
import {
  clampConditioning,
  CONDITIONING_RECOVERY_PER_GAME,
  CONDITIONING_RECOVERY_WHILE_PLAYING_HURT,
  conditioningDecayPerMissedGame,
  conditioningLossOnInjury,
} from "@/lib/careers/conditioning-rules";

export interface NewInjury {
  playerId: string;
  severity: string;
  durationGames: number;
  injuryType: InjuryType;
}

// Appelé une fois par équipe juste après la résolution d'un match (pas les
// deux rosters concaténés : `facilitiesLevel` diffère d'une équipe à
// l'autre) : pour chaque joueur du roster, décompte l'indisponibilité en
// cours (guérison, repos ou jeu forcé sur blessure mineure) ou tire une
// nouvelle blessure — et ajuste le conditionnement physique dans tous les
// cas. `boxScore` sert à savoir qui a réellement joué ce match (nécessaire
// pour distinguer repos complet et jeu forcé malgré la blessure). Retourne
// les blessures VRAIMENT nouvelles ce match (pas les aggravations/rechutes
// d'une blessure déjà en cours) — l'appelant (simulate.ts) s'en sert pour
// notifier la boîte de réception, gaté aux équipes gérées par un humain.
// Les modifications sont déposées dans `patches` (écrites en une fois par
// l'appelant, voir player-state-patches.ts).
export async function advanceRosterInjuries(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  facilitiesLevel = 50,
  // Staff médical (TeamState.trainingStaffLevel) et intensité
  // d'entraînement : modulent le risque du jour (voir injuryChance).
  context: { medicalLevel: number; intensity: TrainingIntensity | null } = { medicalLevel: 50, intensity: null }
): Promise<NewInjury[]> {
  const playedIds = new Set(boxScore.map((e) => e.playerId));
  const newInjuries: NewInjury[] = [];

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
          patches.set(player.id, {
            injuryGamesRemaining: player.injuryGamesRemaining + extra,
            injurySeverity: newSeverity,
            playingThroughInjury: newSeverity === "minor" ? player.playingThroughInjury : false,
            conditioning: clampConditioning(
              player.conditioning - conditioningLossOnInjury(newSeverity) / 2
            ),
          });
        } else if (outcome === "reinjury") {
          // Une nouvelle blessure distincte, contractée en compensant,
          // remplace le décompte en cours.
          const injury = rollInjury();
          patches.set(player.id, {
            injuryGamesRemaining: injury.games,
            injurySeverity: injury.severity,
            injuryType: injury.type,
            playingThroughInjury: false,
            conditioning: clampConditioning(player.conditioning - conditioningLossOnInjury(injury.severity)),
          });
        } else {
          // Aucun incident ce match : décompte normal, récupération de
          // conditionnement réduite (jouer diminué guérit moins vite que le
          // repos complet).
          const remaining = player.injuryGamesRemaining - 1;
          const recovered = clampConditioning(
            player.conditioning + CONDITIONING_RECOVERY_WHILE_PLAYING_HURT
          );
          patches.set(
            player.id,
            remaining > 0
              ? { injuryGamesRemaining: remaining, conditioning: recovered }
              : {
                  injured: false,
                  injuryGamesRemaining: 0,
                  injurySeverity: null,
                  injuryType: null,
                  playingThroughInjury: false,
                  conditioning: recovered,
                }
          );
        }
      } else {
        // Repos complet (n'a pas joué ce match) : décompte normal, légère
        // érosion de conditionnement tant qu'il reste hors des terrains.
        const remaining = player.injuryGamesRemaining - 1;
        const decayed = clampConditioning(
          player.conditioning - conditioningDecayPerMissedGame(severity)
        );
        patches.set(
          player.id,
          remaining > 0
            ? { injuryGamesRemaining: remaining, conditioning: decayed }
            : {
                injured: false,
                injuryGamesRemaining: 0,
                injurySeverity: null,
                injuryType: null,
                playingThroughInjury: false,
                conditioning: decayed,
              }
        );
      }
    } else if (
      Math.random() <
      injuryChance({
        injuryRisk: player.injuryRisk,
        fatigue: player.fatigue,
        wear: player.wear ?? 0,
        age: player.age,
        facilitiesLevel,
        medicalLevel: context.medicalLevel,
        intensity: context.intensity,
        played: playedIds.has(player.id),
      })
    ) {
      // Risque du jour (prédisposition × fatigue × usure × âge ×
      // entraînement × staff) : une blessure nommée, de durée réaliste.
      const injury = rollInjury();
      patches.set(player.id, {
        injured: true,
        injuryGamesRemaining: injury.games,
        injurySeverity: injury.severity,
        injuryType: injury.type,
        conditioning: clampConditioning(player.conditioning - conditioningLossOnInjury(injury.severity)),
      });
      newInjuries.push({
        playerId: player.id,
        severity: injury.severity,
        durationGames: injury.games,
        injuryType: injury.type,
      });
    } else if (player.conditioning < 100) {
      patches.set(player.id, {
        conditioning: clampConditioning(player.conditioning + CONDITIONING_RECOVERY_PER_GAME),
      });
    }
  }

  return newInjuries;
}

// Date de retour estimée : le match de l'équipe qui suit les `gamesOut`
// prochains (toutes compétitions confondues), ou null si la saison se
// termine avant.
export async function estimatedReturnDate(
  careerId: string,
  teamId: string,
  after: Date,
  gamesOut: number
): Promise<Date | null> {
  const game = await prisma.game.findFirst({
    where: {
      careerId,
      status: { not: "final" },
      gameDate: { gt: after },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "asc" },
    skip: Math.max(0, gamesOut),
    select: { gameDate: true },
  });
  return game?.gameDate ?? null;
}

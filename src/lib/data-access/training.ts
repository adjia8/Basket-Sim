import "server-only";
import type { PlayerStatePatches } from "./player-state-patches";
import type { BoxScoreEntry, Player } from "@/lib/types";
import {
  attributeToDevelop,
  developmentChance,
  PROGRESS_PER_OVERALL_POINT,
} from "@/lib/careers/development-rules";
import {
  TRAINING_FOCUS_ATTRIBUTES,
  nextTrainingBoost,
  type TrainingFocus,
  type TrainingIntensity,
} from "@/lib/careers/training-rules";

// Appelé une fois par équipe juste après la résolution d'un match : fait
// dériver le bonus d'entraînement de chaque joueur du roster complet vers le
// plafond de l'intensité si le focus courant cible des attributs, vers 0
// sinon (focus changé, ou "chemistry"/"rest" qui ne ciblent aucun attribut
// individuel) — même pattern que advanceTeamChemistry.
export async function advanceRosterTraining(
  patches: PlayerStatePatches,
  roster: Player[],
  teamFocus: TrainingFocus | null,
  teamIntensity: TrainingIntensity
): Promise<void> {
  const focusTargetsAttributes = teamFocus !== null && TRAINING_FOCUS_ATTRIBUTES[teamFocus].length > 0;

  for (const player of roster) {
    patches.set(player.id, {
      trainingBoost: nextTrainingBoost(player.trainingBoost, focusTargetsAttributes, teamIntensity),
      trainingBoostFocus: focusTargetsAttributes ? teamFocus : null,
    });
  }
}

// Progression en cours de saison des jeunes (voir development-rules.ts) :
// un point d'attribut gagné de temps en temps selon l'âge, les minutes,
// l'intensité et le staff ; tous les PROGRESS_PER_OVERALL_POINT points,
// l'overall monte d'un cran.
export async function advanceRosterDevelopment(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  teamFocus: TrainingFocus | null,
  intensity: TrainingIntensity | null,
  staffLevel: number
): Promise<void> {
  const minutesById = new Map(boxScore.map((e) => [e.playerId, e.minutesPlayed]));
  for (const player of roster) {
    if (player.injured) continue;
    const chance = developmentChance(player.age, minutesById.get(player.id) ?? 0, intensity, staffLevel);
    if (chance === 0 || Math.random() >= chance) continue;
    const attribute = attributeToDevelop(player.individualFocus, teamFocus);
    const progress = (player.developmentProgress ?? 0) + 1;
    const levelUp = progress >= PROGRESS_PER_OVERALL_POINT;
    patches.set(player.id, {
      [attribute]: Math.min(99, player.ratings[attribute] + 1),
      developmentProgress: levelUp ? 0 : progress,
      ...(levelUp ? { overallRating: Math.min(99, player.overallRating + 1) } : {}),
    });
  }
}

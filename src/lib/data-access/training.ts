import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
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
  careerId: string,
  roster: Player[],
  teamFocus: TrainingFocus | null,
  teamIntensity: TrainingIntensity
): Promise<void> {
  const focusTargetsAttributes = teamFocus !== null && TRAINING_FOCUS_ATTRIBUTES[teamFocus].length > 0;

  for (const player of roster) {
    const newBoost = nextTrainingBoost(player.trainingBoost, focusTargetsAttributes, teamIntensity);
    await prisma.playerState.updateMany({
      where: { careerId, playerId: player.id },
      data: {
        trainingBoost: newBoost,
        trainingBoostFocus: focusTargetsAttributes ? teamFocus : null,
      },
    });
  }
}

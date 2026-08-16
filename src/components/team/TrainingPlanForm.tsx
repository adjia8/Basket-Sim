import { getTranslator } from "@/lib/i18n/translate";
import { TrainingPlanFormClient } from "./TrainingPlanFormClient";
import type { TrainingFocus, TrainingIntensity } from "@/lib/careers/training-rules";

export async function TrainingPlanForm({ focus, intensity }: { focus: string | null; intensity: string }) {
  const { t } = await getTranslator();

  const focusOptions: { value: TrainingFocus; label: string }[] = [
    { value: "offensive", label: t("training.focus.offensive") },
    { value: "defensive", label: t("training.focus.defensive") },
    { value: "tactical", label: t("training.focus.tactical") },
    { value: "physical", label: t("training.focus.physical") },
    { value: "chemistry", label: t("training.focus.chemistry") },
    { value: "rest", label: t("training.focus.rest") },
  ];
  const intensityOptions: { value: TrainingIntensity; label: string }[] = [
    { value: "low", label: t("training.intensity.low") },
    { value: "medium", label: t("training.intensity.medium") },
    { value: "high", label: t("training.intensity.high") },
  ];

  return (
    <TrainingPlanFormClient
      focus={focus}
      intensity={intensity}
      labels={{
        title: t("training.title"),
        description: t("training.description"),
        focusLabel: t("training.focusLabel"),
        intensityLabel: t("training.intensityLabel"),
        fatigueImpactPrefix: t("training.fatigueImpactPrefix"),
        apply: t("training.apply"),
        applying: t("training.applying"),
        focusOptions,
        intensityOptions,
      }}
    />
  );
}

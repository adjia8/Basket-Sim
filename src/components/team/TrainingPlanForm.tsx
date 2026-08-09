import { setTrainingPlan } from "@/app/actions/training";
import { getTranslator } from "@/lib/i18n/translate";
import type { TrainingFocus, TrainingIntensity } from "@/lib/careers/training-rules";

const SELECT_CLASSES =
  "rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10";

export async function TrainingPlanForm({
  focus,
  intensity,
}: {
  focus: string | null;
  intensity: string;
}) {
  const { t } = await getTranslator();

  const FOCUS_OPTIONS: { value: TrainingFocus; label: string }[] = [
    { value: "offensive", label: t("training.focus.offensive") },
    { value: "defensive", label: t("training.focus.defensive") },
    { value: "tactical", label: t("training.focus.tactical") },
    { value: "physical", label: t("training.focus.physical") },
    { value: "chemistry", label: t("training.focus.chemistry") },
    { value: "rest", label: t("training.focus.rest") },
  ];

  const INTENSITY_OPTIONS: { value: TrainingIntensity; label: string }[] = [
    { value: "low", label: t("training.intensity.low") },
    { value: "medium", label: t("training.intensity.medium") },
    { value: "high", label: t("training.intensity.high") },
  ];

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="font-medium">{t("training.title")}</p>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">{t("training.description")}</p>
      <form action={setTrainingPlan} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          {t("training.focusLabel")}
          <select name="focus" defaultValue={focus ?? "rest"} className={SELECT_CLASSES}>
            {FOCUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          {t("training.intensityLabel")}
          <select name="intensity" defaultValue={intensity} className={SELECT_CLASSES}>
            {INTENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {t("training.apply")}
        </button>
      </form>
    </div>
  );
}

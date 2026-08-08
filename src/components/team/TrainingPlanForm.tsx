import { setTrainingPlan } from "@/app/actions/training";
import type { TrainingFocus, TrainingIntensity } from "@/lib/careers/training-rules";

const FOCUS_OPTIONS: { value: TrainingFocus; label: string }[] = [
  { value: "offensive", label: "Offensif" },
  { value: "defensive", label: "Défensif" },
  { value: "tactical", label: "Tactique" },
  { value: "physical", label: "Physique" },
  { value: "chemistry", label: "Cohésion d'équipe" },
  { value: "rest", label: "Repos" },
];

const INTENSITY_OPTIONS: { value: TrainingIntensity; label: string }[] = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Élevée" },
];

const SELECT_CLASSES =
  "rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10";

export function TrainingPlanForm({
  focus,
  intensity,
}: {
  focus: string | null;
  intensity: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="font-medium">Programme d&apos;entraînement</p>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Un focus ciblant des attributs (offensif, défensif, tactique,
        physique) fait progresser ces attributs de quelques points tant qu&apos;il
        reste actif. La cohésion accélère la chimie d&apos;équipe, le repos
        réduit la fatigue plus vite. Une intensité plus élevée accentue
        l&apos;effet, mais coûte plus de fatigue.
      </p>
      <form action={setTrainingPlan} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          Focus
          <select name="focus" defaultValue={focus ?? "rest"} className={SELECT_CLASSES}>
            {FOCUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          Intensité
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
          Appliquer
        </button>
      </form>
    </div>
  );
}

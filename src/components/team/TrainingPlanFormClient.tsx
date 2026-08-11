"use client";

import { useActionState } from "react";
import { setTrainingPlan, type TrainingPlanFormState } from "@/app/actions/training";
import type { TrainingFocus, TrainingIntensity } from "@/lib/careers/training-rules";

export interface TrainingPlanFormLabels {
  title: string;
  description: string;
  focusLabel: string;
  intensityLabel: string;
  apply: string;
  applying: string;
  focusOptions: { value: TrainingFocus; label: string }[];
  intensityOptions: { value: TrainingIntensity; label: string }[];
}

const SELECT_CLASSES =
  "rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10";

export function TrainingPlanFormClient({
  focus,
  intensity,
  labels,
}: {
  focus: string | null;
  intensity: string;
  labels: TrainingPlanFormLabels;
}) {
  const [state, action, pending] = useActionState<TrainingPlanFormState | undefined, FormData>(
    setTrainingPlan,
    undefined
  );

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="font-medium">{labels.title}</p>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">{labels.description}</p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          {labels.focusLabel}
          <select name="focus" defaultValue={focus ?? "rest"} className={SELECT_CLASSES}>
            {labels.focusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
          {labels.intensityLabel}
          <select name="intensity" defaultValue={intensity} className={SELECT_CLASSES}>
            {labels.intensityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {pending ? labels.applying : labels.apply}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-500">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{state.success}</p>}
    </div>
  );
}

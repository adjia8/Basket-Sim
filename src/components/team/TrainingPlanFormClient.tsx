"use client";

import { useActionState, useState } from "react";
import { setTrainingPlan, type TrainingPlanFormState } from "@/app/actions/training";
import { trainingFatigueDelta, type TrainingFocus, type TrainingIntensity } from "@/lib/careers/training-rules";

export interface TrainingPlanFormLabels {
  title: string;
  description: string;
  focusLabel: string;
  intensityLabel: string;
  fatigueImpactPrefix: string;
  apply: string;
  applying: string;
  focusOptions: { value: TrainingFocus; label: string }[];
  intensityOptions: { value: TrainingIntensity; label: string }[];
}

const SELECT_CLASSES =
  "field px-3 py-1.5 text-sm";

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
  // État local rien que pour l'aperçu d'impact fatigue en direct (le focus/
  // l'intensité réels ne changent qu'à la soumission du formulaire, via
  // action) — l'intensité amplifie déjà le coût en fatigue côté moteur
  // (voir trainingFatigueDelta), ce contrôle rend cet effet visible avant
  // même de cliquer "Appliquer" plutôt que de rester une phrase dans la
  // description.
  const [previewFocus, setPreviewFocus] = useState<TrainingFocus>((focus as TrainingFocus) ?? "rest");
  const [previewIntensity, setPreviewIntensity] = useState<TrainingIntensity>(intensity as TrainingIntensity);
  const fatigueDelta = Math.round(trainingFatigueDelta(previewFocus, previewIntensity));
  const fatigueSign = fatigueDelta > 0 ? "+" : "";

  return (
    <div className="card p-4">
      <p className="font-medium">{labels.title}</p>
      <p className="mt-1 text-xs text-muted">{labels.description}</p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.focusLabel}
          <select
            name="focus"
            value={previewFocus}
            onChange={(e) => setPreviewFocus(e.target.value as TrainingFocus)}
            className={SELECT_CLASSES}
          >
            {labels.focusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.intensityLabel}
          <select
            name="intensity"
            value={previewIntensity}
            onChange={(e) => setPreviewIntensity(e.target.value as TrainingIntensity)}
            className={SELECT_CLASSES}
          >
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
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? labels.applying : labels.apply}
        </button>
      </form>
      <p
        className={`mt-2 text-xs font-medium ${
          fatigueDelta > 0
            ? "text-warn"
            : fatigueDelta < 0
              ? "text-good"
              : "text-muted"
        }`}
      >
        {labels.fatigueImpactPrefix} {fatigueSign}
        {fatigueDelta}
      </p>
      {state?.error && <p className="mt-2 text-sm text-bad">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-good">{state.success}</p>}
    </div>
  );
}

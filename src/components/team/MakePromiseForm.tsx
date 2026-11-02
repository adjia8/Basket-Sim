"use client";

import { useActionState } from "react";
import { makePromise, type MakePromiseFormState } from "@/app/actions/promise";
import type { PromiseType } from "@/lib/careers/promise-rules";

export interface MakePromiseLabels {
  selectLabel: string;
  submitButton: string;
  submitting: string;
  typeLabels: Record<PromiseType, string>;
}

export function MakePromiseForm({
  playerId,
  availableTypes,
  labels,
}: {
  playerId: string;
  availableTypes: PromiseType[];
  labels: MakePromiseLabels;
}) {
  const [state, action, pending] = useActionState<MakePromiseFormState | undefined, FormData>(
    makePromise,
    undefined
  );

  if (availableTypes.length === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="playerId" value={playerId} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        {labels.selectLabel}
        <select
          name="promiseType"
          defaultValue={availableTypes[0]}
          className="field px-3 py-1.5 text-sm"
        >
          {availableTypes.map((type) => (
            <option key={type} value={type}>
              {labels.typeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.submitting : labels.submitButton}
      </button>
      {state?.error && <p className="w-full text-sm text-bad">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-good">{state.success}</p>}
    </form>
  );
}

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
      <label className="flex flex-col gap-1 text-xs text-black/50 dark:text-white/50">
        {labels.selectLabel}
        <select
          name="promiseType"
          defaultValue={availableTypes[0]}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
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
        className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? labels.submitting : labels.submitButton}
      </button>
      {state?.error && <p className="w-full text-sm text-red-500">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-600 dark:text-green-400">{state.success}</p>}
    </form>
  );
}

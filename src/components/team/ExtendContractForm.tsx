"use client";

import { useActionState } from "react";
import { extendContract, type ExtendContractFormState } from "@/app/actions/roster";
import { EXTENSION_MAX_OFFER_YEARS, EXTENSION_MIN_OFFER_YEARS } from "@/lib/careers/contract-type-rules";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir players/[playerId]/page.tsx) — jamais de
// fonction `t` passée à travers la frontière serveur/client.
export interface ExtendContractLabels {
  proposedSalary: string;
  duration: string;
  proposing: string;
  proposeButton: string;
  rookieNote: string;
}

export function ExtendContractForm({
  playerId,
  minSalary,
  maxSalary,
  suggestedSalary,
  suggestedYears,
  isRookieScale,
  labels,
}: {
  playerId: string;
  minSalary: number;
  maxSalary: number;
  suggestedSalary: number;
  suggestedYears: number;
  isRookieScale: boolean;
  labels: ExtendContractLabels;
}) {
  const [state, action, pending] = useActionState<ExtendContractFormState | undefined, FormData>(
    extendContract,
    undefined
  );

  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-3">
      <input type="hidden" name="playerId" value={playerId} />
      <label className="text-xs text-black/50 dark:text-white/50">
        {labels.proposedSalary}
        <input
          type="number"
          name="salary"
          min={minSalary}
          max={maxSalary}
          step={1}
          defaultValue={suggestedSalary}
          className="mt-0.5 block w-36 rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-black dark:border-white/10 dark:text-white"
        />
      </label>
      <label className="text-xs text-black/50 dark:text-white/50">
        {labels.duration}
        <input
          type="number"
          name="years"
          min={EXTENSION_MIN_OFFER_YEARS}
          max={EXTENSION_MAX_OFFER_YEARS}
          defaultValue={suggestedYears}
          className="mt-0.5 block w-16 rounded border border-black/10 bg-transparent px-2 py-1 text-sm text-black dark:border-white/10 dark:text-white"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? labels.proposing : labels.proposeButton}
      </button>
      {isRookieScale && <p className="w-full text-xs text-black/50 dark:text-white/50">{labels.rookieNote}</p>}
      {state?.error && <p className="w-full text-sm text-red-500">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-green-600 dark:text-green-400">{state.success}</p>}
    </form>
  );
}

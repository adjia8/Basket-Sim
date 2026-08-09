"use client";

import { useActionState } from "react";
import { promoteToStandardContract, type PromoteContractFormState } from "@/app/actions/roster";

export interface PromoteContractLabels {
  button: string;
  proposing: string;
}

export function PromoteContractForm({
  playerId,
  labels,
}: {
  playerId: string;
  labels: PromoteContractLabels;
}) {
  const [state, action, pending] = useActionState<PromoteContractFormState | undefined, FormData>(
    promoteToStandardContract,
    undefined
  );

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="playerId" value={playerId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
      >
        {pending ? labels.proposing : labels.button}
      </button>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600 dark:text-green-400">{state.success}</p>}
    </form>
  );
}

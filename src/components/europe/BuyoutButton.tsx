"use client";

import { useActionState } from "react";
import { buyoutPlayer } from "@/app/actions/europe";

// Racheter le contrat européen d'un joueur (ou faire venir un joueur drafté resté en Europe).
export function BuyoutButton({ playerId, label, pendingLabel, disabled }: { playerId: string; label: string; pendingLabel: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(buyoutPlayer, undefined);
  return (
    <form action={action} data-testid="buyout-form">
      <input type="hidden" name="playerId" value={playerId} />
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? pendingLabel : label}
      </button>
      {state?.error && <p className="mt-1 text-xs text-bad">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-good" data-testid="buyout-result">{state.success}</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { toggleTradeBlock } from "@/app/actions/trade";

// Mettre un joueur sur le marché (les équipes IA font des offres) ou l'en retirer.
export function TradeBlockButton({
  playerId,
  onBlock,
  labels,
  compact = false,
}: {
  playerId: string;
  onBlock: boolean;
  labels: { add: string; remove: string; pending: string };
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(toggleTradeBlock, undefined);
  return (
    <form action={action} className={compact ? "inline" : ""} data-testid="trade-block-form">
      <input type="hidden" name="playerId" value={playerId} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          onBlock ? "border border-line-strong hover:bg-surface-2" : "bg-accent text-accent-fg hover:bg-accent-hover"
        }`}
      >
        {pending ? labels.pending : onBlock ? labels.remove : labels.add}
      </button>
      {!compact && state?.error && <p className="mt-1 text-xs text-bad">{state.error}</p>}
      {!compact && state?.success && <p className="mt-1 text-xs text-good" data-testid="trade-block-result">{state.success}</p>}
    </form>
  );
}

// Choisir un de mes joueurs à mettre sur le marché (page Échanges).
export function TradeBlockPicker({
  players,
  labels,
}: {
  players: { id: string; label: string }[];
  labels: { choose: string; add: string; pending: string };
}) {
  const [state, action, pending] = useActionState(toggleTradeBlock, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2" data-testid="trade-block-picker">
      <select name="playerId" className="field px-2 py-1.5 text-sm" defaultValue="" required>
        <option value="" disabled>
          {labels.choose}
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.pending : labels.add}
      </button>
      {state?.error && <p className="w-full text-xs text-bad">{state.error}</p>}
      {state?.success && <p className="w-full text-xs text-good" data-testid="trade-block-result">{state.success}</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { lifestyleAction } from "@/app/actions/gm";

// Un article du train de vie : acheter ou revendre.
export function LifestyleItemCard({
  item,
  labels,
}: {
  item: { key: string; name: string; price: string; prestige: string; fans: string | null; owned: boolean; affordable: boolean };
  labels: { buy: string; sell: string; owned: string };
}) {
  const [state, action, pending] = useActionState(lifestyleAction, undefined);
  return (
    <div className={`card flex flex-col p-3 ${item.owned ? "border-good/50" : ""}`} data-testid={`lifestyle-${item.key}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{item.name}</p>
        {item.owned && <span className="shrink-0 rounded bg-good/15 px-1.5 py-0.5 text-[11px] font-semibold text-good">{labels.owned}</span>}
      </div>
      <p className="mt-1 text-sm font-semibold tabular">{item.price}</p>
      <p className="text-xs text-accent-text">
        {item.prestige}
        {item.fans && <span className="text-good"> · {item.fans}</span>}
      </p>
      <form action={action} className="mt-auto pt-2">
        <input type="hidden" name="item" value={item.key} />
        <input type="hidden" name="mode" value={item.owned ? "sell" : "buy"} />
        <button
          type="submit"
          disabled={pending || (!item.owned && !item.affordable)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            item.owned ? "border border-line hover:bg-surface-2" : "bg-accent text-accent-fg hover:bg-accent-hover"
          }`}
        >
          {item.owned ? labels.sell : labels.buy}
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-bad">{state.error}</p>}
      {state?.success && <p className="mt-1 text-xs text-good">{state.success}</p>}
    </div>
  );
}

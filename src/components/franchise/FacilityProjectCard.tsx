"use client";

import { useActionState, useState } from "react";
import { startProject } from "@/app/actions/franchise";

// Carte d'un projet d'infrastructure : palier suivant (coût, durée,
// entretien, effets), état du chantier, choix du financement.

export interface FinancingOption {
  value: "cash" | "loan" | "owners";
  label: string;
  disabled: boolean;
}

export interface ProjectCardView {
  key: string;
  name: string;
  desc: string;
  tierLabel: string | null; // « Palier 1/3 » ou « Relançable »
  builtDots: { total: number; built: number } | null;
  status: { text: string; tone: "info" | "muted" | "warn" } | null;
  progressPct: number | null; // chantier en cours
  next: { title: string; effects: string[]; cost: string; duration: string; upkeep: string | null } | null;
  financing: FinancingOption[];
  canStart: boolean;
  warning: string | null;
}

export function FacilityProjectCard({
  view,
  labels,
}: {
  view: ProjectCardView;
  labels: { financingTitle: string; start: string; starting: string; cost: string };
}) {
  const [state, action, pending] = useActionState(startProject, undefined);
  const firstEnabled = view.financing.find((f) => !f.disabled)?.value ?? "cash";
  const [financing, setFinancing] = useState<string>(firstEnabled);
  const chosen = view.financing.find((f) => f.value === financing);
  const disabled = !view.canStart || !chosen || chosen.disabled || pending;

  return (
    <div className="card flex flex-col p-4" data-testid={`project-${view.key}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{view.name}</p>
        {view.builtDots ? (
          <span className="flex shrink-0 gap-1 pt-1.5" title={view.tierLabel ?? undefined}>
            {Array.from({ length: view.builtDots.total }, (_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i < view.builtDots!.built ? "bg-good" : "bg-surface-3"}`} />
            ))}
          </span>
        ) : (
          view.tierLabel && <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-soft">{view.tierLabel}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{view.desc}</p>

      {view.status && (
        <p className={`mt-3 text-xs font-medium ${view.status.tone === "info" ? "text-info" : view.status.tone === "warn" ? "text-warn" : "text-muted"}`}>
          {view.status.text}
        </p>
      )}
      {view.progressPct !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-info" style={{ width: `${Math.max(3, view.progressPct)}%` }} />
        </div>
      )}

      {view.next && (
        <div className="mt-3 rounded-md bg-surface-2 p-2.5 text-xs">
          <p className="font-medium text-soft">{view.next.title}</p>
          <ul className="mt-1 space-y-0.5">
            {view.next.effects.map((e) => (
              <li key={e} className="text-good">
                + {e}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-faint">
            {labels.cost} <span className="font-semibold text-soft tabular">{view.next.cost}</span> · {view.next.duration}
            {view.next.upkeep && ` · ${view.next.upkeep}`}
          </p>
        </div>
      )}

      {view.next && view.canStart && (
        <form action={action} className="mt-3 space-y-1.5 text-xs">
          <input type="hidden" name="projectKey" value={view.key} />
          <p className="eyebrow">{labels.financingTitle}</p>
          {view.financing.map((f) => (
            <label key={f.value} className={`flex items-start gap-2 ${f.disabled ? "opacity-40" : "cursor-pointer"}`}>
              <input
                type="radio"
                name="financing"
                value={f.value}
                checked={financing === f.value}
                disabled={f.disabled}
                onChange={() => setFinancing(f.value)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>{f.label}</span>
            </label>
          ))}
          {view.warning && <p className="text-warn">{view.warning}</p>}
          <button
            type="submit"
            disabled={disabled}
            className="mt-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? labels.starting : labels.start}
          </button>
        </form>
      )}
      {state?.error && <p className="mt-2 text-xs text-bad">{state.error}</p>}
      {state?.success && <p className="mt-2 text-xs text-good">{state.success}</p>}
    </div>
  );
}

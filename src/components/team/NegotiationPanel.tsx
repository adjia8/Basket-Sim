"use client";

import { useActionState, useState } from "react";
import { negotiateContract, type NegotiationFormState } from "@/app/actions/negotiation";

// Composant client : tout le texte arrive déjà traduit en props depuis la
// fiche joueur (Server Component) — jamais de fonction `t` côté client.
export interface NegotiationLabels {
  title: string;
  ask: string;
  patience: string;
  salary: string;
  years: string;
  option: string;
  optionNone: string;
  optionPlayer: string;
  optionTeam: string;
  optionHint: string;
  submit: string;
  submitting: string;
  counterHeading: string;
  counterText: string | null;
  acceptCounter: string;
  note: string | null;
  blocked: string | null;
}

export function NegotiationPanel({
  playerId,
  minSalary,
  maxSalary,
  suggestedSalary,
  suggestedYears,
  patienceLeft,
  patienceMax,
  hasCounter,
  labels,
}: {
  playerId: string;
  minSalary: number;
  maxSalary: number;
  suggestedSalary: number;
  suggestedYears: number;
  patienceLeft: number;
  patienceMax: number;
  hasCounter: boolean;
  labels: NegotiationLabels;
}) {
  const [state, action, pending] = useActionState<NegotiationFormState | undefined, FormData>(negotiateContract, undefined);
  const [years, setYears] = useState(suggestedYears);
  const done = !!state?.success;

  return (
    <div className="mt-4 card p-3" data-testid="negotiation">
      <p className="text-sm font-medium">{labels.title}</p>
      <p className="mt-1 text-sm text-soft">{labels.ask}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
        {labels.patience}
        <span aria-label={`${patienceLeft}/${patienceMax}`} className="flex gap-1">
          {Array.from({ length: patienceMax }, (_, i) => (
            <span key={i} className={`inline-block h-2 w-2 rounded-full ${i < patienceLeft ? "bg-good" : "bg-muted/30"}`} />
          ))}
        </span>
      </p>

      {labels.blocked ? (
        <p className="mt-2 text-sm text-bad">{labels.blocked}</p>
      ) : (
        !done && (
          <>
            {hasCounter && labels.counterText && (
              <form action={action} className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 p-2">
                <input type="hidden" name="playerId" value={playerId} />
                <input type="hidden" name="mode" value="acceptCounter" />
                <span className="text-sm">
                  <span className="font-medium">{labels.counterHeading} : </span>
                  {labels.counterText}
                </span>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-good px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                >
                  {labels.acceptCounter}
                </button>
              </form>
            )}
            <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="playerId" value={playerId} />
              <input type="hidden" name="mode" value="offer" />
              <label className="text-xs text-muted">
                {labels.salary}
                <input
                  type="number"
                  name="salary"
                  min={Math.ceil(minSalary / 10000) * 10000}
                  max={Math.floor(maxSalary / 10000) * 10000}
                  step={10000}
                  defaultValue={suggestedSalary}
                  className="mt-0.5 block w-36 field px-2 py-1 text-sm text-fg"
                />
              </label>
              <label className="text-xs text-muted">
                {labels.years}
                <select
                  name="years"
                  value={years}
                  onChange={(e) => setYears(Number(e.target.value))}
                  className="mt-0.5 block field px-2 py-1 text-sm text-fg"
                >
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                {labels.option}
                <select name="option" defaultValue="none" className="mt-0.5 block field px-2 py-1 text-sm text-fg">
                  <option value="none">{labels.optionNone}</option>
                  <option value="player" disabled={years < 2}>
                    {labels.optionPlayer}
                  </option>
                  <option value="team" disabled={years < 2}>
                    {labels.optionTeam}
                  </option>
                </select>
              </label>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? labels.submitting : labels.submit}
              </button>
              <p className="w-full text-xs text-muted">{labels.optionHint}</p>
              {labels.note && <p className="w-full text-xs text-muted">{labels.note}</p>}
            </form>
          </>
        )
      )}
      {state?.info && <p className="mt-2 text-sm text-accent-text">{state.info}</p>}
      {state?.error && <p className="mt-2 text-sm text-bad">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-good">{state.success}</p>}
    </div>
  );
}

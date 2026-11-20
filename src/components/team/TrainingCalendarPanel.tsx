"use client";

import { useActionState, useState } from "react";
import { saveTrainingCalendar, type TrainingCalendarFormState } from "@/app/actions/training";

// Calendrier d'entraînement des 14 prochains jours (voir
// training-calendar-rules.ts) : textes déjà traduits par la page d'équipe.
export interface CalendarPanelDay {
  date: string;
  label: string; // « lun. 16 nov. »
  game: string | null; // « vs BOS » les jours de match
  session: string | null; // séance effective
  autoSession: string | null; // séance du modèle ce jour-là
  custom: boolean;
}

export function TrainingCalendarPanel({
  active,
  template,
  days,
  templates,
  sessions,
  labels,
}: {
  active: boolean;
  template: string;
  days: CalendarPanelDay[];
  templates: { value: string; label: string }[];
  sessions: { value: string; label: string }[];
  labels: Record<"title" | "subtitle" | "inactive" | "activate" | "template" | "save" | "saving" | "reset" | "offButton" | "game" | "custom" | "auto", string>;
}) {
  const [state, action, pending] = useActionState<TrainingCalendarFormState | undefined, FormData>(saveTrainingCalendar, undefined);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const sessionLabel = new Map(sessions.map((s) => [s.value, s.label]));

  return (
    <section className="mt-6 card p-4" data-testid="training-calendar">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{labels.title}</h3>
      <p className="mt-1 text-xs text-faint">{labels.subtitle}</p>
      <form action={action} className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{labels.template}</span>
          <select name="template" defaultValue={template} className="field px-2 py-1" disabled={pending}>
            {templates.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {!active && <p className="text-xs text-muted">{labels.inactive}</p>}
        {active && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {days.map((d) => (
              <li
                key={d.date}
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${d.game ? "border-accent/40 bg-accent/5" : "border-line"}`}
              >
                <span className="text-xs text-muted">{d.label}</span>
                {d.game ? (
                  <span className="text-xs font-semibold text-accent-text">
                    🏀 {labels.game} {d.game}
                  </span>
                ) : (
                  <select
                    name={changed[d.date] ? `day:${d.date}` : undefined}
                    value={changed[d.date] ?? (d.custom ? d.session ?? "auto" : "auto")}
                    onChange={(e) => setChanged({ ...changed, [d.date]: e.target.value })}
                    className="field max-w-[60%] px-1.5 py-0.5 text-xs"
                    disabled={pending}
                    aria-label={d.label}
                  >
                    <option value="auto">
                      {labels.auto} · {sessionLabel.get(d.autoSession ?? "")}
                    </option>
                    {sessions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="mode"
            value="save"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-1.5 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? labels.saving : active ? labels.save : labels.activate}
          </button>
          {active && (
            <>
              <button type="submit" name="mode" value="reset" disabled={pending} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">
                {labels.reset}
              </button>
              <button type="submit" name="mode" value="off" disabled={pending} className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2">
                {labels.offButton}
              </button>
            </>
          )}
        </div>
        {state?.error && <p className="text-bad">{state.error}</p>}
        {state?.success && <p className="text-good">{state.success}</p>}
      </form>
    </section>
  );
}

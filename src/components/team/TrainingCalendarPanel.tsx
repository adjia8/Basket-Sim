"use client";

import { useActionState, useState } from "react";
import { saveTrainingCalendar, type TrainingCalendarFormState } from "@/app/actions/training";

// Calendrier d'entraînement sur 4 semaines, en grille lundi → dimanche (voir
// training-calendar-rules.ts, month-grid.ts) : textes traduits par la page.
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
  weeks,
  weekdayLabels,
  templates,
  sessions,
  labels,
}: {
  active: boolean;
  template: string;
  days: CalendarPanelDay[];
  weeks: string[][]; // semaines lundi → dimanche (voir month-grid.ts)
  weekdayLabels: string[];
  templates: { value: string; label: string }[];
  sessions: { value: string; label: string; short: string }[];
  labels: Record<"title" | "subtitle" | "inactive" | "activate" | "template" | "save" | "saving" | "reset" | "offButton" | "game" | "custom" | "auto" | "past", string>;
}) {
  const [state, action, pending] = useActionState<TrainingCalendarFormState | undefined, FormData>(saveTrainingCalendar, undefined);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const sessionShort = new Map(sessions.map((s) => [s.value, s.short]));
  const dayByDate = new Map(days.map((d) => [d.date, d]));

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
          // Grille hebdomadaire (lundi → dimanche) : jours passés grisés, jours
          // de match en couleur, séance modifiable les autres jours.
          <div data-testid="training-grid">
            <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase tracking-wide text-faint sm:gap-1.5 sm:text-xs">
              {weekdayLabels.map((d) => (
                <div key={d} className="pb-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {weeks.flat().map((date) => {
                const d = dayByDate.get(date);
                const dayNumber = Number(date.slice(8));
                if (!d) {
                  return (
                    <div key={date} className="flex min-h-16 min-w-0 flex-col rounded-md border border-line-soft p-1 opacity-35" title={labels.past}>
                      <span className="text-2xs tabular text-muted sm:text-xs">{dayNumber}</span>
                    </div>
                  );
                }
                if (d.game) {
                  return (
                    <div key={date} className="flex min-h-16 min-w-0 flex-col rounded-md border border-accent/40 bg-accent/10 p-1" title={d.label}>
                      <span className="text-2xs tabular text-muted sm:text-xs">{dayNumber}</span>
                      <span className="mt-auto truncate text-2xs font-semibold text-accent-text sm:text-xs">
                        <span className="hidden sm:inline">🏀 </span>
                        {d.game.replace(/^vs /, "").replace(/^@ /, "@")}
                      </span>
                    </div>
                  );
                }
                const value = changed[date] ?? (d.custom ? d.session ?? "auto" : "auto");
                const custom = value !== "auto";
                return (
                  <label
                    key={date}
                    className={`flex min-h-16 min-w-0 flex-col gap-1 rounded-md border p-1 ${custom ? "border-info/50 bg-info/5" : "border-line"}`}
                    title={d.label}
                  >
                    <span className="text-2xs tabular text-muted sm:text-xs">{dayNumber}</span>
                    <select
                      name={changed[date] ? `day:${date}` : undefined}
                      value={value}
                      onChange={(e) => setChanged({ ...changed, [date]: e.target.value })}
                      className="field mt-auto w-full min-w-0 appearance-none px-0.5 py-0.5 text-center text-2xs sm:appearance-auto sm:px-1 sm:text-left sm:text-xs"
                      disabled={pending}
                      aria-label={d.label}
                    >
                      <option value="auto">{sessionShort.get(d.autoSession ?? "") ?? labels.auto}</option>
                      {sessions.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.short}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-2xs text-faint">
              <span className="mr-3"><span className="inline-block h-2 w-2 rounded-sm border border-line align-middle" /> {labels.auto}</span>
              <span className="mr-3"><span className="inline-block h-2 w-2 rounded-sm border border-info/50 bg-info/20 align-middle" /> {labels.custom}</span>
              <span><span className="inline-block h-2 w-2 rounded-sm bg-accent/40 align-middle" /> {labels.game}</span>
            </p>
          </div>
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

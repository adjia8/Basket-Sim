"use client";

import { useState } from "react";
import { advanceCalendar } from "@/app/actions/simulate-bulk";
import { withClientTimeout, ClientTimeoutError } from "@/lib/client-timeout";

// Façon Football Manager : simule les matchs IA un par un (même contrainte
// de coût que les boutons de /schedule) jusqu'à tomber sur mon propre
// prochain match, qui n'est jamais auto-simulé — voir simulate-bulk.ts.
export interface AdvanceCalendarButtonLabels {
  button: string; // "Avancer jusqu'au prochain match"
  runningPrefix: string; // "Avancement en cours — matchs IA simulés :"
  upToDate: string; // "Tu es à jour — il ne reste plus qu'à jouer ton prochain match."
  error: string;
  timedOut: string; // appel anormalement long (voir client-timeout.ts)
}

export function AdvanceCalendarButton({ labels }: { labels: AdvanceCalendarButtonLabels }) {
  const [running, setRunning] = useState(false);
  const [simulated, setSimulated] = useState(0);
  const [upToDate, setUpToDate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setUpToDate(false);
    setSimulated(0);
    while (true) {
      let res;
      try {
        res = await withClientTimeout(advanceCalendar());
      } catch (err) {
        setError(err instanceof ClientTimeoutError ? labels.timedOut : labels.error);
        break;
      }
      if (res.error) {
        setError(labels.error);
        break;
      }
      if (res.simulated === 0) {
        setUpToDate(true);
        break;
      }
      setSimulated((prev) => prev + res.simulated);
    }
    setRunning(false);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {labels.button}
      </button>
      {running && (
        <p className="text-xs text-black/50 dark:text-white/50">
          {labels.runningPrefix} {simulated}
        </p>
      )}
      {!running && upToDate && <p className="text-xs text-green-600 dark:text-green-400">{labels.upToDate}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

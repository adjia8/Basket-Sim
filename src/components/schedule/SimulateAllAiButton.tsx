"use client";

import { useState } from "react";
import { simulateAllAiGames } from "@/app/actions/simulate-bulk";
import { withClientTimeout, ClientTimeoutError } from "@/lib/client-timeout";

// Composant client : ne fait qu'orchestrer les appels répétés à l'action
// serveur (elle-même limitée à un petit lot par appel, voir
// simulate-bulk.ts) et afficher la progression — les libellés arrivent déjà
// traduits du Server Component appelant (voir schedule/page.tsx).
export interface SimulateAllAiButtonLabels {
  button: string;
  runningPrefix: string; // "Simulation en cours :"
  remainingSuffix: string; // "matchs restants"
  done: string;
  error: string;
  timedOut: string; // appel anormalement long (voir client-timeout.ts)
}

export function SimulateAllAiButton({
  initialCount,
  labels,
}: {
  initialCount: number;
  labels: SimulateAllAiButtonLabels;
}) {
  const [remaining, setRemaining] = useState(initialCount);
  const [totalSimulated, setTotalSimulated] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    let currentRemaining = remaining;
    while (currentRemaining > 0) {
      let res;
      try {
        res = await withClientTimeout(simulateAllAiGames());
      } catch (err) {
        setError(err instanceof ClientTimeoutError ? labels.timedOut : labels.error);
        break;
      }
      if (res.error) {
        setError(labels.error);
        break;
      }
      setTotalSimulated((prev) => prev + res.simulated);
      setRemaining(res.remaining);
      currentRemaining = res.remaining;
      // Filet de sécurité : si un lot ne progresse plus (tous les matchs
      // restants échouent), ne pas boucler indéfiniment.
      if (res.simulated === 0) break;
    }
    setRunning(false);
    if (currentRemaining === 0) setFinished(true);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={running || remaining === 0}
        className="rounded-full bg-black/5 px-3 py-1 text-sm transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20"
      >
        {labels.button}
      </button>
      {running && (
        <p className="text-xs text-black/50 dark:text-white/50">
          {labels.runningPrefix} {totalSimulated} · {remaining} {labels.remainingSuffix}
        </p>
      )}
      {!running && finished && <p className="text-xs text-green-600 dark:text-green-400">{labels.done}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { simulateNextMyGames } from "@/app/actions/simulate-bulk";
import { withClientTimeout, ClientTimeoutError } from "@/lib/client-timeout";

// Pendant de SimulateAllAiButton pour les matchs DE l'équipe du joueur —
// même principe (petit lot par appel serveur, boucle côté client), mais
// borné par un nombre de matchs choisi par l'utilisateur plutôt que "tout
// simuler". S'arrête aussi si le serveur signale que le prochain match
// oppose deux managers humains (voir simulate-bulk.ts).
export interface SimulateNextMyGamesButtonLabels {
  label: string; // "Simuler les prochains matchs :"
  button: string; // "Simuler"
  runningPrefix: string; // "Simulation en cours — matchs simulés :"
  remainingSuffix: string; // "restants"
  done: string;
  error: string;
  waiting: string; // le prochain match implique un autre manager
  timedOut: string; // appel anormalement long (voir client-timeout.ts)
}

export function SimulateNextMyGamesButton({
  initialRemaining,
  maxCount,
  labels,
}: {
  initialRemaining: number;
  maxCount: number;
  labels: SimulateNextMyGamesButtonLabels;
}) {
  const [count, setCount] = useState(Math.min(5, maxCount));
  const [remaining, setRemaining] = useState(initialRemaining);
  const [totalSimulated, setTotalSimulated] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [finished, setFinished] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    setWaiting(false);
    setFinished(false);
    let done = 0;
    while (done < count) {
      let res;
      try {
        res = await withClientTimeout(simulateNextMyGames());
      } catch (err) {
        setError(err instanceof ClientTimeoutError ? labels.timedOut : labels.error);
        break;
      }
      if (res.error) {
        setError(labels.error);
        break;
      }
      setRemaining(res.remaining);
      if (res.simulated === 0) {
        if (res.blockedByOtherManager) setWaiting(true);
        break;
      }
      done += res.simulated;
      setTotalSimulated((prev) => prev + res.simulated);
    }
    setRunning(false);
    if (done >= count) setFinished(true);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-black/70 dark:text-white/70">{labels.label}</span>
        <input
          type="number"
          min={1}
          max={maxCount}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(maxCount, Number(e.target.value) || 1)))}
          disabled={running}
          className="w-16 rounded-full border border-black/10 bg-transparent px-3 py-1 text-sm dark:border-white/10"
        />
        <button
          type="button"
          onClick={run}
          disabled={running || remaining === 0}
          className="rounded-full bg-black/5 px-3 py-1 text-sm transition hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20"
        >
          {labels.button}
        </button>
      </div>
      {running && (
        <p className="text-xs text-black/50 dark:text-white/50">
          {labels.runningPrefix} {totalSimulated} · {remaining} {labels.remainingSuffix}
        </p>
      )}
      {!running && finished && <p className="text-xs text-green-600 dark:text-green-400">{labels.done}</p>}
      {!running && waiting && <p className="text-xs text-orange-500 dark:text-orange-400">{labels.waiting}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

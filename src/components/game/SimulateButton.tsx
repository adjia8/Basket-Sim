"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir game/[gameId]/page.tsx).
export interface SimulateButtonLabels {
  simulate: string;
  simulating: string;
  waitingForPrefix: string;
  simulationFailed: string;
  unknownError: string;
  otherManagerFallback: string;
}

export function SimulateButton({
  gameId,
  initialWaitingFor,
  labels,
}: {
  gameId: string;
  initialWaitingFor?: string | null;
  labels: SimulateButtonLabels;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(initialWaitingFor ?? null);
  const router = useRouter();

  async function handleClick() {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? labels.simulationFailed);
      }
      if (data?.simulated) {
        router.refresh();
      } else {
        setWaitingFor(data?.waitingFor ?? labels.otherManagerFallback);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.unknownError);
    } finally {
      setIsPending(false);
    }
  }

  if (waitingFor) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        {labels.waitingForPrefix} {waitingFor}…
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full bg-black px-6 py-2 font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {isPending ? labels.simulating : labels.simulate}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

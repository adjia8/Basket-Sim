"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SimulateButton({
  gameId,
  initialWaitingFor,
}: {
  gameId: string;
  initialWaitingFor?: string | null;
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
        throw new Error(data?.error ?? "La simulation a échoué");
      }
      if (data?.simulated) {
        router.refresh();
      } else {
        setWaitingFor(data?.waitingFor ?? "l'autre manager");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsPending(false);
    }
  }

  if (waitingFor) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        En attente de {waitingFor}…
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
        {isPending ? "Simulation…" : "Simuler le match"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

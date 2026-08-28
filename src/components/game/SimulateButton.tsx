"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withClientTimeout, ClientTimeoutError } from "@/lib/client-timeout";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir game/[gameId]/page.tsx).
export interface SimulateButtonLabels {
  simulate: string;
  simulating: string;
  waitingForPrefix: string;
  simulationFailed: string;
  unknownError: string;
  otherManagerFallback: string;
  timedOut: string; // appel anormalement long (voir client-timeout.ts)
  simulatingHint: string; // "Ça peut prendre jusqu'à une minute…" — évite l'impression que rien ne se passe
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
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(initialWaitingFor ?? null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const router = useRouter();
  // router.refresh() ne bloque pas : il lance juste la mise à jour en
  // arrière-plan (nouvelle requête RSC + re-rendu), qui peut elle-même
  // prendre plusieurs secondes sous forte charge — confirmé en pratique
  // jusqu'à 30s dans cet environnement de dev. En ne suivant que la requête
  // fetch(), le bouton redevenait cliquable AVANT que le résultat affiché
  // n'ait réellement changé, laissant l'impression que rien ne s'était
  // passé. startTransition (via useTransition) garde isRefreshing vrai
  // jusqu'à ce que React ait fini d'appliquer les nouvelles données.
  const isPending = isFetching || isRefreshing;

  // Un match coûte ~20-50s à simuler (voir simulate-bulk.ts) — sans retour
  // visuel pendant l'attente, ce délai normal se voit signalé comme "rien
  // ne se passe" (voir l'historique de ce fichier). Un compteur qui avance
  // chaque seconde prouve que ça travaille toujours, sans attendre le
  // garde-fou de timeout (90s, voir client-timeout.ts) pour le confirmer.
  useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPending]);

  async function handleClick() {
    setIsFetching(true);
    setError(null);
    setElapsedSeconds(0);
    try {
      const res = await withClientTimeout(
        fetch("/api/simulate-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        })
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 409 = le match est déjà terminé côté serveur (déclenché par
        // l'autre manager, un autre onglet, ou un clic précédent dont la
        // réponse s'est perdue en route sous latence Neon) — la vraie
        // source de vérité est la DB, pas ce que cet onglet croit encore
        // afficher : on rafraîchit plutôt que de bloquer sur une erreur qui
        // ne reflète qu'un état client périmé.
        if (res.status === 409) {
          startTransition(() => router.refresh());
          return;
        }
        throw new Error(data?.error ?? labels.simulationFailed);
      }
      if (data?.simulated) {
        startTransition(() => router.refresh());
      } else {
        setWaitingFor(data?.waitingFor ?? labels.otherManagerFallback);
      }
    } catch (err) {
      if (err instanceof ClientTimeoutError) {
        setError(labels.timedOut);
      } else {
        setError(err instanceof Error ? err.message : labels.unknownError);
      }
    } finally {
      setIsFetching(false);
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
        {isPending ? `${labels.simulating} (${elapsedSeconds}s)` : labels.simulate}
      </button>
      {isPending && <p className="text-xs text-black/50 dark:text-white/50">{labels.simulatingHint}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

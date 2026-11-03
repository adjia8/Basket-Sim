"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { continueGame } from "@/app/actions/simulate-bulk";
import { withClientTimeout } from "@/lib/client-timeout";

export interface ContinueButtonLabels {
  continue: string; // "Continuer"
  playGame: string; // "Jouer le match"
  progress: string; // "{count} match(s) joué(s)…"
  playing: string; // "Match en cours…"
  waitingFor: string; // "En attente de {name}"
  error: string;
}

// Bouton « Continuer » de la barre du haut (voir GameTopBar.tsx) :
// - hors jour de match : avance le calendrier par lots (continueGame)
//   jusqu'au jour de mon prochain match, puis ouvre ce match ;
// - le jour du match (tous les autres matchs du jour déjà joués) : joue mon
//   match (même route que le bouton de la page du match) et ouvre le
//   résultat.
export function ContinueButton({
  isMatchDay,
  nextGameId,
  labels,
}: {
  isMatchDay: boolean;
  nextGameId: string | null;
  labels: ContinueButtonLabels;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goTo(href: string) {
    startTransition(() => {
      router.push(href);
      router.refresh();
    });
  }

  async function playMyGame(gameId: string) {
    setStatus(labels.playing);
    const res = await withClientTimeout(
      fetch("/api/simulate-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      })
    );
    const data = await res.json().catch(() => null);
    // 409 : déjà joué entre-temps — on affiche simplement le match.
    if (!res.ok && res.status !== 409) throw new Error(data?.error);
    if (res.ok && !data?.simulated) {
      setStatus(labels.waitingFor.replace("{name}", data?.waitingFor ?? ""));
      return;
    }
    setStatus(null);
    goTo(`/game/${gameId}`);
  }

  async function advance() {
    let count = 0;
    setStatus(labels.progress.replace("{count}", "0"));
    for (;;) {
      const res = await withClientTimeout(continueGame());
      if (res.kind === "error") throw new Error();
      if (res.kind === "advanced") {
        count += res.simulated;
        setStatus(labels.progress.replace("{count}", String(count)));
        continue;
      }
      setStatus(null);
      goTo(res.kind === "matchDay" ? `/game/${res.gameId}` : "/");
      return;
    }
  }

  async function run() {
    setRunning(true);
    setError(null);
    try {
      if (isMatchDay && nextGameId) await playMyGame(nextGameId);
      else await advance();
    } catch {
      setStatus(null);
      setError(labels.error);
    } finally {
      setRunning(false);
    }
  }

  const busy = running || isRefreshing;
  return (
    <div className="flex shrink-0 items-center gap-3">
      {(status || error) && (
        <span className={`hidden text-xs sm:inline ${error ? "text-bad" : "text-muted"}`} aria-live="polite">
          {error ?? status}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
      >
        {busy && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-fg/30 border-t-accent-fg" aria-hidden />
        )}
        {isMatchDay && nextGameId ? labels.playGame : labels.continue}
        {!busy && <span aria-hidden>▸</span>}
      </button>
    </div>
  );
}

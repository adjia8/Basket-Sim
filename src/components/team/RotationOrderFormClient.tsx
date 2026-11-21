"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setRotationOrder, type RotationOrderFormState } from "@/app/actions/rotation";
import { ROTATION_SIZE } from "@/lib/simulation/mockEngine";
import type { RotationOrderPlayer } from "@/lib/careers/rotation-rules";
import { injuryBadge, type InjuryBadgeKind, type InjuryBadgeTone } from "@/lib/careers/injury-report-rules";
import Link from "next/link";
import { playerHref } from "@/lib/utils";
import { EnergyRing } from "./EnergyRing";

const BADGE_TONE: Record<InjuryBadgeTone, string> = {
  red: "bg-bad/15 text-bad",
  orange: "bg-warn/15 text-warn",
  green: "bg-good/15 text-good",
};

export interface RotationOrderLabels {
  injury: Record<InjuryBadgeKind, string>; // « {games} » remplacé par le nombre de matchs
  description: string;
  activeHeading: string;
  reserveHeading: string;
  roleStarter: string;
  roleSixthWoman: string;
  roleBench: string;
  dragHandle: string;
  addToRotation: string;
  removeFromRotation: string;
  save: string;
  saving: string;
}

function roleLabel(index: number, labels: RotationOrderLabels): string {
  if (index < 5) return labels.roleStarter;
  if (index === 5) return labels.roleSixthWoman;
  return labels.roleBench;
}

export function RotationOrderFormClient({
  teamId,
  initialOrder,
  labels,
}: {
  teamId: string;
  initialOrder: RotationOrderPlayer[];
  labels: RotationOrderLabels;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const orderRef = useRef(order);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [state, action, pending] = useActionState<RotationOrderFormState | undefined, FormData>(
    setRotationOrder,
    undefined
  );

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  function moveTo(id: string, targetIndex: number) {
    setOrder((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      if (from === -1 || from === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  // Retirer envoie la joueuse en toute fin de liste (dernière priorité de
  // banc) ; ajouter l'insère juste avant la limite ROTATION_SIZE, ce qui
  // repousse mécaniquement la dernière joueuse de la rotation active vers
  // le haut du groupe "hors rotation" — même modèle que le moteur (le rôle
  // n'est jamais qu'une question de position dans un seul tableau).
  function removeFromRotation(id: string) {
    setOrder((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      if (from === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.push(moved);
      return next;
    });
  }

  function addToRotation(id: string) {
    setOrder((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      if (from === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(Math.min(ROTATION_SIZE - 1, next.length), 0, moved);
      return next;
    });
  }

  // Ligne dont le milieu est le plus proche du pointeur — glisser-déposer
  // "au survol", pas un calcul de zone de dépôt précis : suffisant pour
  // réordonner une petite liste (12-14 joueuses au plus) et beaucoup plus
  // robuste que le drag-and-drop HTML5 natif sur mobile (Pointer Events
  // couvre souris/tactile/stylet avec le même code, l'API native non).
  // Fonctionne aussi bien pour réordonner à l'intérieur d'un groupe que
  // pour faire passer une joueuse d'un groupe à l'autre (les deux listes
  // ne sont que deux vues du même tableau `order`, coupées à ROTATION_SIZE).
  function nearestIndex(y: number): number {
    let closest = 0;
    let closestDist = Infinity;
    orderRef.current.forEach((player, index) => {
      const el = itemRefs.current.get(player.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(mid - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = index;
      }
    });
    return closest;
  }

  function startDrag(id: string) {
    setDraggingId(id);

    function handlePointerMove(e: PointerEvent) {
      moveTo(id, nearestIndex(e.clientY));
    }
    function stopDrag() {
      setDraggingId(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
  }

  function handleHandleKeyDown(e: React.KeyboardEvent, id: string, index: number) {
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      moveTo(id, index - 1);
    } else if (e.key === "ArrowDown" && index < order.length - 1) {
      e.preventDefault();
      moveTo(id, index + 1);
    }
  }

  function renderRow(player: RotationOrderPlayer, index: number, inRotation: boolean) {
    return (
      <li
        key={player.id}
        ref={(el) => {
          if (el) itemRefs.current.set(player.id, el);
          else itemRefs.current.delete(player.id);
        }}
        className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition sm:gap-3 sm:px-3 ${
          draggingId === player.id
            ? "border-line-strong bg-surface-2 shadow-sm"
            : "border-line-soft"
        }`}
      >
        <button
          type="button"
          aria-label={labels.dragHandle}
          onPointerDown={(e) => {
            e.preventDefault();
            startDrag(player.id);
          }}
          onKeyDown={(e) => handleHandleKeyDown(e, player.id, index)}
          className="touch-none cursor-grab select-none rounded px-1.5 py-1 text-base leading-none text-faint hover:bg-surface-2 active:cursor-grabbing"
        >
          ⠿
        </button>
        <span className="hidden w-6 text-center text-faint sm:inline">{index + 1}</span>
        {/* Nom sur une ligne (tronqué si besoin), poste et note dessous : sur
            mobile, le nom ne s'écrase plus mot par mot. */}
        <span className="min-w-0 flex-1">
          <Link href={playerHref(player.id, teamId)} className="block truncate hover:underline">
            <span className="hidden sm:inline">#{player.jerseyNumber} </span>
            {player.firstName} {player.lastName}
          </Link>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-faint">
            {player.position} · {player.overallRating}
            {(() => {
              const badge = injuryBadge(player);
              return badge ? (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${BADGE_TONE[badge.tone]}`}
                  data-testid="injury-badge"
                  data-tone={badge.tone}
                >
                  🩹 {labels.injury[badge.kind].replace("{games}", String(badge.games))}
                </span>
              ) : null;
            })()}
          </span>
        </span>
        <EnergyRing fatigue={player.fatigue} size={34} />
        {inRotation ? (
          <span className="w-[4.5rem] shrink-0 rounded-full bg-surface-2 px-1 py-0.5 text-center text-[10px] font-medium leading-tight text-soft sm:w-28 sm:px-2 sm:text-xs">
            {roleLabel(index, labels)}
          </span>
        ) : (
          // Largeur fixe identique au badge de rôle (même si vide) — sans
          // ça, l'anneau d'énergie se décale ligne par ligne selon que le
          // texte du badge voisin ("Titulaire"/"6ème femme"/"Banc", ou rien
          // du tout hors rotation) est plus ou moins large.
          <span className="w-[4.5rem] shrink-0 sm:w-28" aria-hidden />
        )}
        <button
          type="button"
          aria-label={inRotation ? labels.removeFromRotation : labels.addToRotation}
          onClick={() => (inRotation ? removeFromRotation(player.id) : addToRotation(player.id))}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
            inRotation
              ? "bg-bad/10 text-bad hover:bg-bad/20"
              : "bg-good/10 text-good hover:bg-good/20"
          }`}
        >
          {inRotation ? "−" : "+"}
        </button>
      </li>
    );
  }

  const activePlayers = order.slice(0, ROTATION_SIZE);
  const reservePlayers = order.slice(ROTATION_SIZE);

  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{labels.description}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
        {labels.activeHeading}
      </h3>
      <ul className="mt-2 space-y-1">{activePlayers.map((player, index) => renderRow(player, index, true))}</ul>

      {reservePlayers.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            {labels.reserveHeading}
          </h3>
          <ul className="mt-2 space-y-1">
            {reservePlayers.map((player, index) => renderRow(player, index + ROTATION_SIZE, false))}
          </ul>
        </>
      )}

      <form action={action} className="mt-4">
        <input type="hidden" name="order" value={JSON.stringify(order.map((p) => p.id))} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? labels.saving : labels.save}
        </button>
        {state?.error && <p className="mt-2 text-sm text-bad">{state.error}</p>}
        {state?.success && <p className="mt-2 text-sm text-good">{state.success}</p>}
      </form>
    </div>
  );
}

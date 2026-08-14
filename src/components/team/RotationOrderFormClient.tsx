"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setRotationOrder, type RotationOrderFormState } from "@/app/actions/rotation";
import { ROTATION_SIZE } from "@/lib/simulation/mockEngine";
import type { RotationOrderPlayer } from "@/lib/careers/rotation-rules";
import { FatigueRing } from "./FatigueRing";

export interface RotationOrderLabels {
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
  initialOrder,
  labels,
}: {
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
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
          draggingId === player.id
            ? "border-black/30 bg-black/5 shadow-sm dark:border-white/30 dark:bg-white/10"
            : "border-black/5 dark:border-white/5"
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
          className="touch-none cursor-grab select-none rounded px-1.5 py-1 text-base leading-none text-black/40 hover:bg-black/5 active:cursor-grabbing dark:text-white/40 dark:hover:bg-white/10"
        >
          ⠿
        </button>
        <span className="w-6 text-center text-black/40 dark:text-white/40">{index + 1}</span>
        <span className="flex-1">
          #{player.jerseyNumber} {player.firstName} {player.lastName}{" "}
          <span className="text-black/40 dark:text-white/40">
            ({player.position}, {player.overallRating})
          </span>
        </span>
        <FatigueRing value={player.fatigue} />
        {inRotation && (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
            {roleLabel(index, labels)}
          </span>
        )}
        <button
          type="button"
          aria-label={inRotation ? labels.removeFromRotation : labels.addToRotation}
          onClick={() => (inRotation ? removeFromRotation(player.id) : addToRotation(player.id))}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold transition ${
            inRotation
              ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
              : "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
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
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs text-black/50 dark:text-white/50">{labels.description}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {labels.activeHeading}
      </h3>
      <ul className="mt-2 space-y-1">{activePlayers.map((player, index) => renderRow(player, index, true))}</ul>

      {reservePlayers.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
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
          className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {pending ? labels.saving : labels.save}
        </button>
        {state?.error && <p className="mt-2 text-sm text-red-500">{state.error}</p>}
        {state?.success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{state.success}</p>}
      </form>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { setRotationOrder, type RotationOrderFormState } from "@/app/actions/rotation";
import { ROTATION_SIZE } from "@/lib/simulation/mockEngine";
import type { RotationOrderPlayer } from "@/lib/careers/rotation-rules";

export interface RotationOrderLabels {
  description: string;
  roleStarter: string;
  roleSixthWoman: string;
  roleBench: string;
  roleOutOfRotation: string;
  moveUp: string;
  moveDown: string;
  save: string;
  saving: string;
}

function roleLabel(index: number, labels: RotationOrderLabels): string {
  if (index < 5) return labels.roleStarter;
  if (index === 5) return labels.roleSixthWoman;
  if (index < ROTATION_SIZE) return labels.roleBench;
  return labels.roleOutOfRotation;
}

export function RotationOrderFormClient({
  initialOrder,
  labels,
}: {
  initialOrder: RotationOrderPlayer[];
  labels: RotationOrderLabels;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [state, action, pending] = useActionState<RotationOrderFormState | undefined, FormData>(
    setRotationOrder,
    undefined
  );

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-xs text-black/50 dark:text-white/50">{labels.description}</p>

      <ul className="mt-3 space-y-1">
        {order.map((player, index) => (
          <li
            key={player.id}
            className="flex items-center gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm dark:border-white/5"
          >
            <span className="w-6 text-center text-black/40 dark:text-white/40">{index + 1}</span>
            <span className="flex-1">
              #{player.jerseyNumber} {player.firstName} {player.lastName}{" "}
              <span className="text-black/40 dark:text-white/40">
                ({player.position}, {player.overallRating})
              </span>
            </span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
              {roleLabel(index, labels)}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={labels.moveUp}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded-full border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/10"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={labels.moveDown}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-full border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10 dark:hover:bg-white/10"
              >
                ▼
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form action={action} className="mt-3">
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

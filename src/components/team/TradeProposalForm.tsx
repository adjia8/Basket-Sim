"use client";

import { useActionState } from "react";
import { proposeTrade } from "@/app/actions/trade";
import { formatSalary } from "@/lib/utils";
import type { RosterPlayer } from "./RosterTable";

export interface TradePick {
  id: string;
  season: string;
  round: number;
  pickNumber: number | null;
  originalTeamId: string;
  teamId: string;
  originalTeamAbbreviation: string;
}

export function TradeProposalForm({
  myRoster,
  theirRoster,
  myPicks,
  theirPicks,
  opponentTeamId,
}: {
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  myPicks: TradePick[];
  theirPicks: TradePick[];
  opponentTeamId: string;
}) {
  const [state, action, pending] = useActionState(proposeTrade, undefined);

  return (
    <div className="mt-8 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-lg font-semibold">Proposer un échange</h2>

      <form action={action} className="mt-4">
        <input type="hidden" name="opponentTeamId" value={opponentTeamId} />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-6">
            <PlayerCheckboxList title="Mes joueurs à offrir" name="myPlayerIds" roster={myRoster} />
            <PickCheckboxList title="Mes picks à offrir" name="myPickIds" picks={myPicks} />
          </div>
          <div className="space-y-6">
            <PlayerCheckboxList title="Leurs joueurs à recevoir" name="theirPlayerIds" roster={theirRoster} />
            <PickCheckboxList title="Leurs picks à recevoir" name="theirPickIds" picks={theirPicks} />
          </div>
        </div>

        {state?.error && (
          <p className="mt-4 text-sm text-red-500">{state.error}</p>
        )}
        {state?.success && (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">
            {state.success}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-full bg-black px-6 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {pending ? "Proposition…" : "Proposer l'échange"}
        </button>
      </form>
    </div>
  );
}

function PlayerCheckboxList({
  title,
  name,
  roster,
}: {
  title: string;
  name: "myPlayerIds" | "theirPlayerIds";
  roster: RosterPlayer[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
        {title}
      </h3>
      <ul className="space-y-1">
        {roster.map((player) => (
          <li key={player.id}>
            <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
              <input type="checkbox" name={name} value={player.id} />
              <span className="flex-1">
                {player.firstName} {player.lastName}{" "}
                <span className="text-black/40 dark:text-white/40">
                  ({player.position}, {player.overallRating})
                </span>
              </span>
              <span className="text-black/50 dark:text-white/50">
                {formatSalary(player.salary)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pickLabel(pick: TradePick): string {
  const base =
    pick.pickNumber !== null
      ? `Pick ${pick.pickNumber} (Tour ${pick.round}, ${pick.season})`
      : `Tour ${pick.round} ${pick.season}`;
  return pick.originalTeamId !== pick.teamId ? `${base} (via ${pick.originalTeamAbbreviation})` : base;
}

function PickCheckboxList({
  title,
  name,
  picks,
}: {
  title: string;
  name: "myPickIds" | "theirPickIds";
  picks: TradePick[];
}) {
  if (picks.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
        {title}
      </h3>
      <ul className="space-y-1">
        {picks.map((pick) => (
          <li key={pick.id}>
            <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">
              <input type="checkbox" name={name} value={pick.id} />
              <span className="flex-1">{pickLabel(pick)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

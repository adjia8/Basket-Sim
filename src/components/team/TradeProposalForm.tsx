"use client";

import { useActionState } from "react";
import { proposeTrade } from "@/app/actions/trade";
import { formatSalary } from "@/lib/utils";
import type { RosterPlayer } from "./RosterTable";

export function TradeProposalForm({
  myRoster,
  theirRoster,
  opponentTeamId,
}: {
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  opponentTeamId: string;
}) {
  const [state, action, pending] = useActionState(proposeTrade, undefined);

  return (
    <div className="mt-8 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-lg font-semibold">Proposer un échange</h2>

      <form action={action} className="mt-4">
        <input type="hidden" name="opponentTeamId" value={opponentTeamId} />

        <div className="grid gap-6 sm:grid-cols-2">
          <PlayerCheckboxList
            title="Mes joueurs à offrir"
            name="myPlayerIds"
            roster={myRoster}
          />
          <PlayerCheckboxList
            title="Leurs joueurs à recevoir"
            name="theirPlayerIds"
            roster={theirRoster}
          />
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

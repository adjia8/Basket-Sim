"use client";

import { useActionState } from "react";
import { proposeTrade } from "@/app/actions/trade";
import type { Locale } from "@/lib/i18n/locale";
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
  // Déjà traduit/interpolé côté serveur (voir teams/[teamId]/page.tsx) — un
  // Server Component ne peut pas passer de fonction (ex: un "pickLabel(pick)")
  // à un Client Component à travers la frontière serveur/client, seulement
  // des données déjà résolues.
  label: string;
}

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir teams/[teamId]/page.tsx) — jamais de
// fonction `t` passée à travers la frontière serveur/client.
export interface TradeProposalLabels {
  title: string;
  myPlayersToOffer: string;
  myPicksToOffer: string;
  theirPlayersToReceive: string;
  theirPicksToReceive: string;
  proposing: string;
  proposeButton: string;
}

export function TradeProposalForm({
  myRoster,
  theirRoster,
  myPicks,
  theirPicks,
  opponentTeamId,
  locale,
  labels,
}: {
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  myPicks: TradePick[];
  theirPicks: TradePick[];
  opponentTeamId: string;
  locale: Locale;
  labels: TradeProposalLabels;
}) {
  const [state, action, pending] = useActionState(proposeTrade, undefined);

  return (
    <div className="mt-8 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-lg font-semibold">{labels.title}</h2>

      <form action={action} className="mt-4">
        <input type="hidden" name="opponentTeamId" value={opponentTeamId} />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-6">
            <PlayerCheckboxList title={labels.myPlayersToOffer} name="myPlayerIds" roster={myRoster} locale={locale} />
            <PickCheckboxList title={labels.myPicksToOffer} name="myPickIds" picks={myPicks} />
          </div>
          <div className="space-y-6">
            <PlayerCheckboxList
              title={labels.theirPlayersToReceive}
              name="theirPlayerIds"
              roster={theirRoster}
              locale={locale}
            />
            <PickCheckboxList title={labels.theirPicksToReceive} name="theirPickIds" picks={theirPicks} />
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
          {pending ? labels.proposing : labels.proposeButton}
        </button>
      </form>
    </div>
  );
}

function PlayerCheckboxList({
  title,
  name,
  roster,
  locale,
}: {
  title: string;
  name: "myPlayerIds" | "theirPlayerIds";
  roster: RosterPlayer[];
  locale: Locale;
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
                {formatSalary(player.salary, locale)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
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
              <span className="flex-1">{pick.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

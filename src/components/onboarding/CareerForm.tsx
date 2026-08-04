"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createCareer } from "@/app/actions/career";
import { teamFullName } from "@/lib/utils";
import type { League, Team } from "@/lib/types";

export function CareerForm({
  leagues,
  teams,
}: {
  leagues: League[];
  teams: Team[];
}) {
  const [leagueId, setLeagueId] = useState<string>(leagues[0]?.id ?? "");
  const [state, action, pending] = useActionState(createCareer, undefined);

  const leagueTeams = teams.filter((t) => t.leagueId === leagueId);

  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        {leagues.map((league) => (
          <button
            key={league.id}
            type="button"
            onClick={() => setLeagueId(league.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              league.id === leagueId
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
            }`}
          >
            {league.code}
          </button>
        ))}
      </div>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input type="hidden" name="leagueId" value={leagueId} />
        {leagueTeams.map((team) => (
          <button
            key={team.id}
            type="submit"
            name="teamId"
            value={team.id}
            disabled={pending}
            className="flex flex-col items-start gap-1 rounded-lg border border-black/10 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:border-white/10"
            style={{ borderTopColor: team.primaryColor, borderTopWidth: 4 }}
          >
            <span className="text-xs font-medium text-black/50 dark:text-white/50">
              {team.abbreviation}
            </span>
            <span className="font-semibold">{teamFullName(team)}</span>
          </button>
        ))}
      </form>
    </div>
  );
}

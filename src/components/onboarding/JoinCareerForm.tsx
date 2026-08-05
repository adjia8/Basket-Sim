"use client";

import { useActionState } from "react";
import { joinCareer } from "@/app/actions/career";
import { teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";
import type { TeamManager } from "@/lib/data-access/memberships";

export function JoinCareerForm({
  inviteCode,
  teams,
  managers,
}: {
  inviteCode: string;
  teams: Team[];
  managers: Record<string, TeamManager>;
}) {
  const [state, action, pending] = useActionState(joinCareer, undefined);

  return (
    <div className="space-y-4">
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input type="hidden" name="inviteCode" value={inviteCode} />
        {teams.map((team) => {
          const takenBy = managers[team.id];
          return (
            <button
              key={team.id}
              type="submit"
              name="teamId"
              value={team.id}
              disabled={pending || Boolean(takenBy)}
              className="flex flex-col items-start gap-1 rounded-lg border border-black/10 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-40 dark:border-white/10"
              style={{ borderTopColor: team.primaryColor, borderTopWidth: 4 }}
            >
              <span className="text-xs font-medium text-black/50 dark:text-white/50">
                {team.abbreviation}
              </span>
              <span className="font-semibold">{teamFullName(team)}</span>
              {takenBy && (
                <span className="text-xs text-black/40 dark:text-white/40">
                  Prise par {takenBy.email}
                </span>
              )}
            </button>
          );
        })}
      </form>
    </div>
  );
}

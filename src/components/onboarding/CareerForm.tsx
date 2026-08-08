"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createCareer } from "@/app/actions/career";
import { FranchiseCarousel } from "./FranchiseCarousel";
import type { League } from "@/lib/types";
import type { FranchiseSummary } from "@/lib/data-access/franchise-summary";

export function CareerForm({
  leagues,
  summariesByLeague,
}: {
  leagues: League[];
  summariesByLeague: Record<string, FranchiseSummary[]>;
}) {
  const [leagueId, setLeagueId] = useState<string>(leagues[0]?.id ?? "");
  const [state, action, pending] = useActionState(createCareer, undefined);

  return (
    <div className="space-y-6">
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

      <FranchiseCarousel
        key={leagueId}
        slides={summariesByLeague[leagueId] ?? []}
        mode="create"
        action={action}
        hiddenFields={{ leagueId }}
        error={state?.error}
        pending={pending}
      />
    </div>
  );
}

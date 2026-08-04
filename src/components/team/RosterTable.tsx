"use client";

import { useMemo, useState } from "react";
import type { Player, PlayerRatings } from "@/lib/types";
import { formatSalary } from "@/lib/utils";
import { releasePlayer } from "@/app/actions/roster";

export type RosterPlayer = Player & { salary: number; yearsRemaining: number };

type SortKey =
  | "overallRating"
  | "age"
  | "salary"
  | "yearsRemaining"
  | "scoring"
  | "playmaking"
  | "rebounding"
  | "defense"
  | "athleticism";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "overallRating", label: "Overall" },
  { key: "age", label: "Âge" },
  { key: "salary", label: "Salaire" },
  { key: "yearsRemaining", label: "Ann. restantes" },
  { key: "scoring", label: "Scoring" },
  { key: "playmaking", label: "Playmaking" },
  { key: "rebounding", label: "Rebonds" },
  { key: "defense", label: "Défense" },
  { key: "athleticism", label: "Athlétisme" },
];

const RATING_KEYS = new Set<SortKey>([
  "scoring",
  "playmaking",
  "rebounding",
  "defense",
  "athleticism",
]);

function valueFor(player: RosterPlayer, key: SortKey): number {
  if (RATING_KEYS.has(key)) {
    return player.ratings[key as keyof PlayerRatings];
  }
  return player[key as "overallRating" | "age" | "salary" | "yearsRemaining"];
}

export function RosterTable({
  roster,
  canRelease = false,
}: {
  roster: RosterPlayer[];
  canRelease?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("overallRating");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...roster];
    copy.sort((a, b) => {
      const diff = valueFor(a, sortKey) - valueFor(b, sortKey);
      return descending ? -diff : diff;
    });
    return copy;
  }, [roster, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
            <th className="py-2 pr-4">Joueur</th>
            <th className="py-2 pr-4">Poste</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="py-2 pr-4">
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="font-medium hover:text-black dark:hover:text-white"
                >
                  {col.label}
                  {sortKey === col.key ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
            {canRelease && <th className="py-2 pr-4">Action</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4 font-medium">
                #{player.jerseyNumber} {player.firstName} {player.lastName}
              </td>
              <td className="py-2 pr-4">{player.position}</td>
              <td className="py-2 pr-4 font-semibold">{player.overallRating}</td>
              <td className="py-2 pr-4">{player.age}</td>
              <td className="py-2 pr-4">{formatSalary(player.salary)}</td>
              <td className="py-2 pr-4">{player.yearsRemaining}</td>
              <td className="py-2 pr-4">{player.ratings.scoring}</td>
              <td className="py-2 pr-4">{player.ratings.playmaking}</td>
              <td className="py-2 pr-4">{player.ratings.rebounding}</td>
              <td className="py-2 pr-4">{player.ratings.defense}</td>
              <td className="py-2">{player.ratings.athleticism}</td>
              {canRelease && (
                <td className="py-2 pr-4">
                  <form action={releasePlayer}>
                    <input type="hidden" name="playerId" value={player.id} />
                    <button
                      type="submit"
                      className="text-red-500 underline-offset-2 hover:underline"
                    >
                      Libérer
                    </button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

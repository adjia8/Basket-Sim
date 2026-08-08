"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";
import { formatSalary } from "@/lib/utils";
import { setPlayingThroughInjury } from "@/app/actions/roster";
import { PlayerAvatar } from "./PlayerAvatar";
import { ratingTone, toneClass } from "@/lib/color-scale";

const SEVERITY_LABELS: Record<NonNullable<Player["injurySeverity"]>, string> = {
  minor: "légère",
  moderate: "modérée",
  severe: "sévère",
};

// Vue d'ensemble scannable de l'effectif — avatar/nationalité/gabarit/stats
// de la saison. Le détail complet (les 10 attributs, contrat, historique,
// actions) vit sur la fiche du joueur (voir players/[playerId]/page.tsx).
export type RosterPlayer = Player & {
  salary: number;
  yearsRemaining: number;
  guaranteed: boolean;
  wantsTrade: boolean;
  ppg: number;
  rpg: number;
  apg: number;
};

type SortKey = "overallRating" | "age" | "heightCm" | "salary" | "yearsRemaining" | "ppg" | "rpg" | "apg";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "overallRating", label: "Overall" },
  { key: "heightCm", label: "Taille" },
  { key: "age", label: "Âge" },
  { key: "salary", label: "Salaire" },
  { key: "yearsRemaining", label: "Ann. restantes" },
  { key: "ppg", label: "Pts/match" },
  { key: "rpg", label: "Reb/match" },
  { key: "apg", label: "Pd/match" },
];

function valueFor(player: RosterPlayer, key: SortKey): number {
  return player[key];
}

export function RosterTable({
  teamId,
  roster,
  canRelease = false,
}: {
  teamId: string;
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
            <th className="py-2 pr-4" />
            <th className="py-2 pr-4">Joueur</th>
            <th className="py-2 pr-4">Poste</th>
            <th className="py-2 pr-4">Nationalité</th>
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
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">
                <PlayerAvatar playerId={player.id} firstName={player.firstName} lastName={player.lastName} />
              </td>
              <td className="py-2 pr-4 font-medium">
                <Link
                  href={`/teams/${teamId}/players/${player.id}`}
                  className="hover:underline"
                >
                  #{player.jerseyNumber} {player.firstName} {player.lastName}
                </Link>
                {player.injured && (
                  <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-500">
                    🩹 Indispo.{" "}
                    {player.injurySeverity ? `(${SEVERITY_LABELS[player.injurySeverity]}, ` : "("}
                    {player.injuryGamesRemaining} matchs)
                  </span>
                )}
                {player.injured && player.injurySeverity === "minor" && canRelease && (
                  <form action={setPlayingThroughInjury} className="ml-2 inline">
                    <input type="hidden" name="playerId" value={player.id} />
                    <input
                      type="hidden"
                      name="value"
                      value={player.playingThroughInjury ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-black/10 px-2 py-0.5 text-xs font-normal hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                    >
                      {player.playingThroughInjury ? "Mettre au repos" : "Jouer malgré la blessure"}
                    </button>
                  </form>
                )}
                {player.wantsTrade && (
                  <span className="ml-2 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-normal text-orange-500">
                    🚩 Veut être échangé
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{player.position}</td>
              <td className="py-2 pr-4">{player.nationality}</td>
              <td className={`py-2 pr-4 font-semibold ${toneClass(ratingTone(player.overallRating))}`}>
                {player.overallRating}
              </td>
              <td className="py-2 pr-4">{player.heightCm} cm</td>
              <td className="py-2 pr-4">{player.age}</td>
              <td className="py-2 pr-4">
                {formatSalary(player.salary)}
                {!player.guaranteed && (
                  <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                    (non garanti)
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{player.yearsRemaining}</td>
              <td className="py-2 pr-4">{player.ppg}</td>
              <td className="py-2 pr-4">{player.rpg}</td>
              <td className="py-2 pr-4">{player.apg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { Player, PlayerRatings } from "@/lib/types";
import { formatSalary } from "@/lib/utils";
import { releasePlayer, setPlayingThroughInjury } from "@/app/actions/roster";

const SEVERITY_LABELS: Record<NonNullable<Player["injurySeverity"]>, string> = {
  minor: "légère",
  moderate: "modérée",
  severe: "sévère",
};

const TRAINING_FOCUS_LABELS: Record<NonNullable<Player["trainingBoostFocus"]>, string> = {
  offensive: "Offensif",
  defensive: "Défensif",
  tactical: "Tactique",
  physical: "Physique",
  chemistry: "Cohésion",
  rest: "Repos",
};

export type RosterPlayer = Player & {
  salary: number;
  yearsRemaining: number;
  guaranteed: boolean;
  wantsTrade: boolean;
};

type SortKey =
  | "overallRating"
  | "age"
  | "salary"
  | "yearsRemaining"
  | "scoringInside"
  | "scoringOutside"
  | "playmaking"
  | "defenseInside"
  | "defenseOutside"
  | "rebounding"
  | "athleticism"
  | "basketballIQ"
  | "clutch"
  | "stamina"
  | "injuryRisk"
  | "renown"
  | "fatigue"
  | "conditioning"
  | "trainingBoost";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "overallRating", label: "Overall" },
  { key: "age", label: "Âge" },
  { key: "salary", label: "Salaire" },
  { key: "yearsRemaining", label: "Ann. restantes" },
  { key: "scoringInside", label: "Scoring intérieur" },
  { key: "scoringOutside", label: "Scoring extérieur" },
  { key: "playmaking", label: "Playmaking" },
  { key: "defenseInside", label: "Défense intérieure" },
  { key: "defenseOutside", label: "Défense extérieure" },
  { key: "rebounding", label: "Rebonds" },
  { key: "athleticism", label: "Athlétisme" },
  { key: "basketballIQ", label: "QI basket" },
  { key: "clutch", label: "Clutch" },
  { key: "stamina", label: "Stamina" },
  { key: "injuryRisk", label: "Risque blessure" },
  { key: "renown", label: "Renommé" },
  { key: "fatigue", label: "Fatigue" },
  { key: "conditioning", label: "Conditionnement" },
  { key: "trainingBoost", label: "Bonus entraînement" },
];

const RATING_KEYS = new Set<SortKey>([
  "scoringInside",
  "scoringOutside",
  "playmaking",
  "defenseInside",
  "defenseOutside",
  "rebounding",
  "athleticism",
  "basketballIQ",
  "clutch",
  "stamina",
]);

function valueFor(player: RosterPlayer, key: SortKey): number {
  if (RATING_KEYS.has(key)) {
    return player.ratings[key as keyof PlayerRatings];
  }
  if (key === "injuryRisk") return player.injuryRisk;
  if (key === "renown") return player.renown;
  if (key === "fatigue") return player.fatigue;
  if (key === "conditioning") return player.conditioning;
  if (key === "trainingBoost") return player.trainingBoost;
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
              <td className="py-2 pr-4 font-semibold">{player.overallRating}</td>
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
              <td className="py-2 pr-4">{player.ratings.scoringInside}</td>
              <td className="py-2 pr-4">{player.ratings.scoringOutside}</td>
              <td className="py-2 pr-4">{player.ratings.playmaking}</td>
              <td className="py-2 pr-4">{player.ratings.defenseInside}</td>
              <td className="py-2 pr-4">{player.ratings.defenseOutside}</td>
              <td className="py-2 pr-4">{player.ratings.rebounding}</td>
              <td className="py-2 pr-4">{player.ratings.athleticism}</td>
              <td className="py-2 pr-4">{player.ratings.basketballIQ}</td>
              <td className="py-2 pr-4">{player.ratings.clutch}</td>
              <td className="py-2 pr-4">{player.ratings.stamina}</td>
              <td className="py-2 pr-4">{player.injuryRisk}</td>
              <td className="py-2 pr-4">{player.renown}</td>
              <td className="py-2 pr-4">{player.fatigue}</td>
              <td className="py-2 pr-4">{player.conditioning}</td>
              <td className="py-2">
                {player.trainingBoost > 0 && player.trainingBoostFocus ? (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-normal text-blue-500">
                    +{player.trainingBoost} {TRAINING_FOCUS_LABELS[player.trainingBoostFocus]}
                  </span>
                ) : (
                  <span className="text-black/30 dark:text-white/30">—</span>
                )}
              </td>
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

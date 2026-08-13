import type { BoxScoreEntry, Player } from "@/lib/types";

interface EntryWithPlayer extends BoxScoreEntry {
  player?: Player;
}

// Server Component (pas de "use client") : peut recevoir des fonctions en
// props sans problème, contrairement à un vrai Client Component — le texte
// vient tout de même déjà traduit du Server Component appelant (voir
// game/[gameId]/page.tsx) pour garder toute la logique i18n au même endroit.
export interface BoxScoreLabels {
  away: string;
  home: string;
  player: string;
  minutes: string;
  points: string;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  rebounds: string;
  assists: string;
  steals: string;
  blocks: string;
  turnovers: string;
  fouls: string;
  team: string;
  technical: (count: number) => string;
  flagrant: (count: number) => string;
  fouledOut: string;
  ejected: string;
}

export function BoxScoreTable({
  entries,
  homeTeamId,
  awayTeamId,
  labels,
}: {
  entries: EntryWithPlayer[];
  homeTeamId: string;
  awayTeamId: string;
  labels: BoxScoreLabels;
}) {
  return (
    <div className="space-y-6">
      <TeamBoxScore
        label={labels.away}
        entries={entries.filter((e) => e.teamId === awayTeamId)}
        labels={labels}
      />
      <TeamBoxScore
        label={labels.home}
        entries={entries.filter((e) => e.teamId === homeTeamId)}
        labels={labels}
      />
    </div>
  );
}

function madeAttempted(made: number, attempted: number): string {
  return `${made}-${attempted}`;
}

function pct(made: number, attempted: number): string {
  return attempted > 0 ? `${Math.round((made / attempted) * 100)}%` : "-";
}

function sumEntries(entries: BoxScoreEntry[]): Omit<BoxScoreEntry, "playerId" | "teamId" | "disqualifiedReason"> {
  return entries.reduce(
    (totals, e) => ({
      points: totals.points + e.points,
      rebounds: totals.rebounds + e.rebounds,
      assists: totals.assists + e.assists,
      personalFouls: totals.personalFouls + e.personalFouls,
      technicalFouls: totals.technicalFouls + e.technicalFouls,
      flagrantFouls: totals.flagrantFouls + e.flagrantFouls,
      fieldGoalsMade: totals.fieldGoalsMade + e.fieldGoalsMade,
      fieldGoalsAttempted: totals.fieldGoalsAttempted + e.fieldGoalsAttempted,
      threePointersMade: totals.threePointersMade + e.threePointersMade,
      threePointersAttempted: totals.threePointersAttempted + e.threePointersAttempted,
      freeThrowsMade: totals.freeThrowsMade + e.freeThrowsMade,
      freeThrowsAttempted: totals.freeThrowsAttempted + e.freeThrowsAttempted,
      steals: totals.steals + e.steals,
      blocks: totals.blocks + e.blocks,
      turnovers: totals.turnovers + e.turnovers,
      minutesPlayed: totals.minutesPlayed + e.minutesPlayed,
    }),
    {
      points: 0, rebounds: 0, assists: 0, personalFouls: 0, technicalFouls: 0, flagrantFouls: 0,
      fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointersMade: 0, threePointersAttempted: 0,
      freeThrowsMade: 0, freeThrowsAttempted: 0, steals: 0, blocks: 0, turnovers: 0, minutesPlayed: 0,
    }
  );
}

function TeamBoxScore({
  label,
  entries,
  labels,
}: {
  label: string;
  entries: EntryWithPlayer[];
  labels: BoxScoreLabels;
}) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const totals = sumEntries(entries);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-black/50 dark:text-white/50">
        {label}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-4">{labels.player}</th>
              <th className="py-2 pr-4">{labels.minutes}</th>
              <th className="py-2 pr-4">{labels.points}</th>
              <th className="py-2 pr-4">{labels.fieldGoals}</th>
              <th className="py-2 pr-4">{labels.threePointers}</th>
              <th className="py-2 pr-4">{labels.freeThrows}</th>
              <th className="py-2 pr-4">{labels.rebounds}</th>
              <th className="py-2 pr-4">{labels.assists}</th>
              <th className="py-2 pr-4">{labels.steals}</th>
              <th className="py-2 pr-4">{labels.blocks}</th>
              <th className="py-2 pr-4">{labels.turnovers}</th>
              <th className="py-2">{labels.fouls}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.playerId} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4">
                  {entry.player
                    ? `${entry.player.firstName} ${entry.player.lastName}`
                    : entry.playerId}
                  {entry.technicalFouls > 0 && (
                    <span className="ml-2 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-normal text-yellow-600 dark:text-yellow-400">
                      {labels.technical(entry.technicalFouls)}
                    </span>
                  )}
                  {entry.flagrantFouls > 0 && (
                    <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-500">
                      {labels.flagrant(entry.flagrantFouls)}
                    </span>
                  )}
                  {entry.disqualifiedReason === "fouled_out" && (
                    <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-500">
                      {labels.fouledOut}
                    </span>
                  )}
                  {entry.disqualifiedReason === "ejected" && (
                    <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-500">
                      {labels.ejected}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{entry.minutesPlayed.toFixed(1)}</td>
                <td className="py-2 pr-4 font-medium">{entry.points}</td>
                <td className="py-2 pr-4">
                  {madeAttempted(entry.fieldGoalsMade, entry.fieldGoalsAttempted)}{" "}
                  <span className="text-black/40 dark:text-white/40">
                    ({pct(entry.fieldGoalsMade, entry.fieldGoalsAttempted)})
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {madeAttempted(entry.threePointersMade, entry.threePointersAttempted)}{" "}
                  <span className="text-black/40 dark:text-white/40">
                    ({pct(entry.threePointersMade, entry.threePointersAttempted)})
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {madeAttempted(entry.freeThrowsMade, entry.freeThrowsAttempted)}{" "}
                  <span className="text-black/40 dark:text-white/40">
                    ({pct(entry.freeThrowsMade, entry.freeThrowsAttempted)})
                  </span>
                </td>
                <td className="py-2 pr-4">{entry.rebounds}</td>
                <td className="py-2 pr-4">{entry.assists}</td>
                <td className="py-2 pr-4">{entry.steals}</td>
                <td className="py-2 pr-4">{entry.blocks}</td>
                <td className="py-2 pr-4">{entry.turnovers}</td>
                <td className="py-2">{entry.personalFouls}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/10 font-medium dark:border-white/10">
              <td className="py-2 pr-4">{labels.team}</td>
              <td className="py-2 pr-4">{totals.minutesPlayed.toFixed(1)}</td>
              <td className="py-2 pr-4">{totals.points}</td>
              <td className="py-2 pr-4">
                {madeAttempted(totals.fieldGoalsMade, totals.fieldGoalsAttempted)}{" "}
                <span className="font-normal text-black/40 dark:text-white/40">
                  ({pct(totals.fieldGoalsMade, totals.fieldGoalsAttempted)})
                </span>
              </td>
              <td className="py-2 pr-4">
                {madeAttempted(totals.threePointersMade, totals.threePointersAttempted)}{" "}
                <span className="font-normal text-black/40 dark:text-white/40">
                  ({pct(totals.threePointersMade, totals.threePointersAttempted)})
                </span>
              </td>
              <td className="py-2 pr-4">
                {madeAttempted(totals.freeThrowsMade, totals.freeThrowsAttempted)}{" "}
                <span className="font-normal text-black/40 dark:text-white/40">
                  ({pct(totals.freeThrowsMade, totals.freeThrowsAttempted)})
                </span>
              </td>
              <td className="py-2 pr-4">{totals.rebounds}</td>
              <td className="py-2 pr-4">{totals.assists}</td>
              <td className="py-2 pr-4">{totals.steals}</td>
              <td className="py-2 pr-4">{totals.blocks}</td>
              <td className="py-2 pr-4">{totals.turnovers}</td>
              <td className="py-2">{totals.personalFouls}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

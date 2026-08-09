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
  points: string;
  rebounds: string;
  assists: string;
  fouls: string;
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

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-black/50 dark:text-white/50">
        {label}
      </h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
            <th className="py-2 pr-4">{labels.player}</th>
            <th className="py-2 pr-4">{labels.points}</th>
            <th className="py-2 pr-4">{labels.rebounds}</th>
            <th className="py-2 pr-4">{labels.assists}</th>
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
              <td className="py-2 pr-4 font-medium">{entry.points}</td>
              <td className="py-2 pr-4">{entry.rebounds}</td>
              <td className="py-2 pr-4">{entry.assists}</td>
              <td className="py-2">{entry.personalFouls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

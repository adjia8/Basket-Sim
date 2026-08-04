import type { BoxScoreEntry, Player } from "@/lib/types";

interface EntryWithPlayer extends BoxScoreEntry {
  player?: Player;
}

export function BoxScoreTable({
  entries,
  homeTeamId,
  awayTeamId,
}: {
  entries: EntryWithPlayer[];
  homeTeamId: string;
  awayTeamId: string;
}) {
  return (
    <div className="space-y-6">
      <TeamBoxScore
        label="Extérieur"
        entries={entries.filter((e) => e.teamId === awayTeamId)}
      />
      <TeamBoxScore
        label="Domicile"
        entries={entries.filter((e) => e.teamId === homeTeamId)}
      />
    </div>
  );
}

function TeamBoxScore({
  label,
  entries,
}: {
  label: string;
  entries: EntryWithPlayer[];
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
            <th className="py-2 pr-4">Joueur</th>
            <th className="py-2 pr-4">Pts</th>
            <th className="py-2 pr-4">Reb</th>
            <th className="py-2">Pd</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.playerId} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">
                {entry.player
                  ? `${entry.player.firstName} ${entry.player.lastName}`
                  : entry.playerId}
              </td>
              <td className="py-2 pr-4 font-medium">{entry.points}</td>
              <td className="py-2 pr-4">{entry.rebounds}</td>
              <td className="py-2">{entry.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import type { Player, Team } from "@/lib/types";
import type { SeasonStats } from "@/lib/data-access/season-stats";
import { teamFullName } from "@/lib/utils";

// Server Component (pas de "use client") : reçoit du texte déjà traduit du
// Server Component appelant (voir game/[gameId]/page.tsx), même convention
// que BoxScoreTable.tsx — un aperçu en lecture seule avant simulation, pas
// de tri/action (contrairement à RosterTable.tsx qui gère MON effectif).
export interface GameRosterPreviewLabels {
  record: string; // "9-3", déjà composé par l'appelant
  rank: string; // "2e/12", déjà composé par l'appelant
  noGamesPlayedYet: string;
  player: string;
  position: string;
  overall: string;
  ppg: string;
  rpg: string;
  apg: string;
}

export function GameRosterPreview({
  team,
  roster,
  seasonStats,
  gamesPlayed,
  labels,
}: {
  team: Team;
  roster: Player[];
  seasonStats: Map<string, SeasonStats>;
  gamesPlayed: number;
  labels: GameRosterPreviewLabels;
}) {
  const sorted = [...roster].sort((a, b) => b.overallRating - a.overallRating);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/teams/${team.id}`} className="font-semibold hover:underline">
          {teamFullName(team)}
        </Link>
        <span className="text-xs text-muted">
          {labels.record} · {labels.rank}
        </span>
      </div>

      {/* Sans ça, une colonne de "-" ressemble à des stats cassées plutôt
          qu'à une équipe qui n'a simplement encore joué aucun match. */}
      {gamesPlayed === 0 && (
        <p className="mt-1 text-xs text-faint">{labels.noGamesPlayedYet}</p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="data-table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-1.5 pr-3">{labels.player}</th>
              <th className="py-1.5 pr-3">{labels.position}</th>
              <th className="py-1.5 pr-3 text-right">{labels.overall}</th>
              <th className="py-1.5 pr-3 text-right">{labels.ppg}</th>
              <th className="py-1.5 pr-3 text-right">{labels.rpg}</th>
              <th className="py-1.5 text-right">{labels.apg}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player) => {
              const stats = seasonStats.get(player.id);
              return (
                <tr key={player.id} className="border-b border-line-soft">
                  <td className="py-1.5 pr-3">
                    <Link href={`/teams/${team.id}/players/${player.id}`} className="hover:underline">
                      {player.firstName} {player.lastName}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-soft">{player.position}</td>
                  <td className="py-1.5 pr-3 text-right">{player.overallRating}</td>
                  <td className="py-1.5 pr-3 text-right">{stats?.ppg.toFixed(1) ?? "-"}</td>
                  <td className="py-1.5 pr-3 text-right">{stats?.rpg.toFixed(1) ?? "-"}</td>
                  <td className="py-1.5 text-right">{stats?.apg.toFixed(1) ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Fusion des lignes de stats d'un joueur sur une saison — règle pure.
//
// PlayerSeasonStat a une ligne par joueur ET par équipe : un joueur échangé
// en cours de saison en a donc plusieurs. Sans fusion, il apparaissait en
// double dans les classements, avec des moyennes coupées en deux (et
// parfois sous le minimum de matchs), ce qui faussait aussi les trophées.

export const STAT_FIELDS = [
  "gamesPlayed",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "tpm",
  "tpa",
  "ftm",
  "fta",
] as const;

export type StatRow = { playerId: string; teamId: string } & Record<(typeof STAT_FIELDS)[number], number>;

// Une ligne par joueur : totaux additionnés, équipe = son équipe actuelle
// (sous contrat) si on la connaît, sinon celle où il a joué le plus.
export function mergeSeasonRows<T extends StatRow>(rows: T[], currentTeamOf: (playerId: string) => string | undefined): StatRow[] {
  const byPlayer = new Map<string, T[]>();
  for (const r of rows) (byPlayer.get(r.playerId) ?? byPlayer.set(r.playerId, []).get(r.playerId)!).push(r);
  return [...byPlayer.entries()].map(([playerId, list]) => {
    const merged = { playerId, teamId: "" } as StatRow;
    for (const f of STAT_FIELDS) merged[f] = list.reduce((s, r) => s + r[f], 0);
    const busiest = [...list].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
    const current = currentTeamOf(playerId);
    merged.teamId = current && list.some((r) => r.teamId === current) ? current : busiest.teamId;
    return merged;
  });
}

// Rapport d'équipe (points forts / points faibles) — règles pures.
//
// Chaque indicateur (statistiques de la saison, attributs de l'effectif) est
// classé parmi toutes les équipes de la ligue : le haut du classement donne
// les points forts, le bas les points faibles. S'y ajoutent la profondeur par
// poste (poste sans joueur de niveau) et quelques pistes concrètes.

export type MetricKey =
  | "ppg"
  | "oppPpg"
  | "rpg"
  | "apg"
  | "spg"
  | "bpg"
  | "tov"
  | "fgPct"
  | "tpPct"
  | "ftPct"
  | "scoringInside"
  | "scoringOutside"
  | "playmaking"
  | "defenseInside"
  | "defenseOutside"
  | "rebounding"
  | "athleticism"
  | "basketballIQ"
  | "clutch"
  | "bench";

export const METRIC_KIND: Record<MetricKey, "stat" | "rating"> = {
  ppg: "stat",
  oppPpg: "stat",
  rpg: "stat",
  apg: "stat",
  spg: "stat",
  bpg: "stat",
  tov: "stat",
  fgPct: "stat",
  tpPct: "stat",
  ftPct: "stat",
  scoringInside: "rating",
  scoringOutside: "rating",
  playmaking: "rating",
  defenseInside: "rating",
  defenseOutside: "rating",
  rebounding: "rating",
  athleticism: "rating",
  basketballIQ: "rating",
  clutch: "rating",
  bench: "rating",
};

// Plus bas = mieux.
const LOWER_IS_BETTER = new Set<MetricKey>(["oppPpg", "tov"]);

export type TeamMetrics = Partial<Record<MetricKey, number>>;

export interface RankedMetric {
  key: MetricKey;
  value: number;
  rank: number; // 1 = meilleure équipe de la ligue
  of: number;
}

// Rang de l'équipe sur chaque indicateur disponible.
export function rankMetrics(teamId: string, league: Map<string, TeamMetrics>): RankedMetric[] {
  const mine = league.get(teamId);
  if (!mine) return [];
  const out: RankedMetric[] = [];
  for (const key of Object.keys(METRIC_KIND) as MetricKey[]) {
    const value = mine[key];
    if (value === undefined || Number.isNaN(value)) continue;
    const values = [...league.values()].map((m) => m[key]).filter((v): v is number => v !== undefined && !Number.isNaN(v));
    const better = values.filter((v) => (LOWER_IS_BETTER.has(key) ? v < value : v > value)).length;
    out.push({ key, value, rank: better + 1, of: values.length });
  }
  return out;
}

// Points forts : dans le premier tiers ; points faibles : dans le dernier
// tiers — les plus marqués d'abord, au plus `limit` chacun.
export function strengthsAndWeaknesses(ranked: RankedMetric[], limit = 5): { strengths: RankedMetric[]; weaknesses: RankedMetric[] } {
  const third = (m: RankedMetric) => Math.max(1, Math.round(m.of / 3));
  const strengths = ranked.filter((m) => m.rank <= third(m)).sort((a, b) => a.rank / a.of - b.rank / b.of).slice(0, limit);
  const weaknesses = ranked
    .filter((m) => m.rank > m.of - third(m))
    .sort((a, b) => b.rank / b.of - a.rank / a.of)
    .slice(0, limit);
  return { strengths, weaknesses };
}

export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

export interface DepthPlayer {
  position: string;
  overall: number;
  injured?: boolean;
}

export interface PositionDepth {
  position: Position;
  best: number; // meilleure note au poste (0 si personne)
  quality: number; // joueurs de niveau titulaire (75+) disponibles
  count: number;
  need: "critical" | "thin" | null;
}

// Profondeur par poste : poste critique s'il n'a aucun joueur disponible de
// niveau NBA correct (72+), fragile s'il n'a qu'un seul joueur à ce poste.
export function positionDepth(players: DepthPlayer[]): PositionDepth[] {
  return POSITIONS.map((position) => {
    const at = players.filter((p) => p.position === position && !p.injured);
    const best = at.reduce((m, p) => Math.max(m, p.overall), 0);
    const quality = at.filter((p) => p.overall >= 75).length;
    const need = best < 72 ? "critical" : at.length < 2 ? "thin" : null;
    return { position, best, quality, count: at.length, need };
  });
}

export type Advice =
  | { kind: "recruit"; position: Position; critical: boolean }
  | { kind: "tactic"; tactic: "inside" | "perimeter" | "pick_and_roll" | "zone" | "switch" }
  | { kind: "training"; focus: "defensive" | "offensive" | "physical" | "tactical" }
  | { kind: "bench" };

// Pistes concrètes tirées du rapport (au plus 4).
export function reportAdvice(ranked: RankedMetric[], depth: PositionDepth[]): Advice[] {
  const by = new Map(ranked.map((m) => [m.key, m]));
  const low = (k: MetricKey) => {
    const m = by.get(k);
    return !!m && m.rank > m.of - Math.round(m.of / 3);
  };
  const high = (k: MetricKey) => {
    const m = by.get(k);
    return !!m && m.rank <= Math.round(m.of / 3);
  };
  const advice: Advice[] = [];
  for (const d of [...depth].sort((a, b) => (a.need === "critical" ? -1 : 0) - (b.need === "critical" ? -1 : 0))) {
    if (d.need === "critical") advice.push({ kind: "recruit", position: d.position, critical: true });
  }
  for (const d of depth) if (d.need === "thin" && advice.length < 2) advice.push({ kind: "recruit", position: d.position, critical: false });
  if (high("scoringOutside") && !high("scoringInside")) advice.push({ kind: "tactic", tactic: "perimeter" });
  else if (high("scoringInside") && !high("scoringOutside")) advice.push({ kind: "tactic", tactic: "inside" });
  else if (high("playmaking")) advice.push({ kind: "tactic", tactic: "pick_and_roll" });
  if (low("defenseInside") || low("rebounding")) advice.push({ kind: "tactic", tactic: "zone" });
  else if (low("defenseOutside")) advice.push({ kind: "tactic", tactic: "switch" });
  if (low("oppPpg") || low("defenseOutside") || low("defenseInside")) advice.push({ kind: "training", focus: "defensive" });
  else if (low("ppg") || low("fgPct")) advice.push({ kind: "training", focus: "offensive" });
  if (low("bench")) advice.push({ kind: "bench" });
  return advice.slice(0, 4);
}

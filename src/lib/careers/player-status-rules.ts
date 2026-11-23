// Statut d'un joueur dans son équipe et valeur marchande tirée de sa
// production réelle — règles pures, sans accès base de données.
//
// Le statut (joueur franchise, star, titulaire, rotation, banc, espoir)
// fixe ses objectifs : le temps de jeu qu'il attend, et donc ce qui le rend
// heureux ou non. La valeur marchande mélange sa note et ses stats de la
// saison : un joueur qui produit plus que sa note demande plus, et
// inversement.

export type PlayerStatus = "franchise" | "star" | "starter" | "rotation" | "prospect" | "bench";

export function playerStatus(params: {
  overall: number;
  renown: number;
  age: number;
  potential: number;
  teamRank: number; // rang de sa note dans l'effectif (1 = meilleur)
}): PlayerStatus {
  const { overall, renown, age, potential, teamRank } = params;
  // Un seul joueur franchise par équipe au plus (son meilleur), des stars
  // seulement parmi les trois premiers : la renommée seule ne suffit pas.
  if (teamRank === 1 && (overall >= 87 || renown >= 85)) return "franchise";
  if (teamRank <= 3 && (overall >= 84 || renown >= 75)) return "star";
  if (teamRank <= 5) return "starter";
  if (age <= 22 && potential - overall >= 6) return "prospect";
  if (teamRank <= 9) return "rotation";
  return "bench";
}

// Minutes par match attendues selon le statut.
// Calées sur la répartition réelle du moteur (saison complète simulée).
export const EXPECTED_MINUTES: Record<PlayerStatus, number> = {
  franchise: 34,
  star: 30,
  starter: 26,
  rotation: 18,
  prospect: 12,
  bench: 8,
};

// Écart toléré sous les minutes attendues avant que le moral ne baisse.
export const MINUTES_TOLERANCE = 8;

export interface ProductionLine {
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
}

// Production ramenée sur l'échelle des notes (40-99), à partir d'un « game
// score » simplifié (points, rebonds, passes, interceptions, contres,
// pertes). Repères : 8 pts / 4 reb / 2 pd ≈ 71 ; 25 / 6 / 5 ≈ 89 ; seules
// les saisons historiques (≈ 30 / 12 / 9) touchent 99. Null en dessous de
// 10 matchs (échantillon trop court).
export const MIN_GAMES_FOR_PRODUCTION = 10;

export function productionRating(line: ProductionLine | null | undefined): number | null {
  if (!line || line.gamesPlayed < MIN_GAMES_FOR_PRODUCTION) return null;
  const gameScore = line.ppg + 0.45 * line.rpg + 0.7 * line.apg + line.spg + 0.7 * line.bpg - 0.7 * line.tpg;
  return Math.max(40, Math.min(99, Math.round(60 + gameScore * 0.95)));
}

// Note « marchande » utilisée pour les exigences salariales : 60 % la note,
// 40 % la production quand elle est connue.
export function marketRating(overall: number, production: number | null): number {
  return production === null ? overall : Math.round(overall * 0.6 + production * 0.4);
}

// Rang qu'aurait un joueur dans un effectif (le sien, ou celui qu'il
// rejoindrait) d'après les notes.
export function rankInRoster(overall: number, otherOveralls: number[]): number {
  return 1 + otherOveralls.filter((o) => o > overall).length;
}

// ---------------------------------------------------------------------------
// Promesse de temps de jeu : le GM promet un statut (« tu seras titulaire »).
// Jugée sur les PROMISE_GAMES matchs suivants de l'équipe : tenue si le
// joueur a joué en moyenne au moins les minutes du statut promis (moins une
// petite marge).
export const PROMISABLE_STATUSES: PlayerStatus[] = ["franchise", "star", "starter", "rotation"];
export const PROMISE_GAMES = 15;
export const PROMISE_MARGIN = 4;
export const PROMISE_MORALE_ON_MAKE = 5;
export const PROMISE_MORALE_HONORED = 8;
export const PROMISE_MORALE_BROKEN = -15;

export function promiseHonored(minutesPerGame: number, promised: PlayerStatus): boolean {
  return minutesPerGame >= EXPECTED_MINUTES[promised] - PROMISE_MARGIN;
}

// Échelle des rôles (un espoir se situe au niveau d'un fin de banc : il
// attend des minutes, pas un rôle établi).
const ROLE_RANK: Record<PlayerStatus, number> = { bench: 0, prospect: 0, rotation: 1, starter: 2, star: 3, franchise: 4 };
export function roleRank(s: PlayerStatus): number {
  return ROLE_RANK[s];
}

// Promesse de temps de jeu en cours de contrat : garantir son rôle actuel
// ou promettre jusqu'à trois crans au-dessus.
export function promisableStatuses(current: PlayerStatus): PlayerStatus[] {
  const r = ROLE_RANK[current];
  return PROMISABLE_STATUSES.filter((s) => ROLE_RANK[s] >= r && ROLE_RANK[s] <= r + 3);
}

// Négociation de contrat : rôle proposé avec l'offre (du plus grand au
// plus petit). « bench » = aucun temps de jeu garanti.
export const OFFERABLE_ROLES: PlayerStatus[] = ["franchise", "star", "starter", "rotation", "bench"];

// Poids du rôle proposé dans la valeur perçue d'une offre, par rapport au
// rôle qu'il attend : un rôle plus grand le convainc (jusqu'à deux crans,
// au-delà il n'y croit pas), un rôle plus petit se paie.
export function roleValueMultiplier(expected: PlayerStatus, offered: PlayerStatus | null | undefined): number {
  if (!offered) return 1;
  const d = ROLE_RANK[offered] - ROLE_RANK[expected];
  if (d < 0) return 1 + 0.07 * d;
  if (d === 0) return 1.02;
  if (d <= 2) return 1.03 + 0.03 * d;
  return 1.02;
}

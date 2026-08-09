// Vrai nombre de matchs de saison régulière par équipe (NBA 82, WNBA 44 —
// format 2025+, voir generate-schedule.ts pour la répartition sur le calendrier).
export const REGULAR_SEASON_GAMES: Record<string, number> = {
  nba: 82,
  wnba: 44,
};

// Durée réelle approximative de la saison régulière, en jours — sert à étaler
// les matchs générés (plusieurs par jour plutôt qu'un tous les 2 jours
// strictement séquentiel, qui étalerait une saison NBA sur des années).
export const SEASON_LENGTH_DAYS: Record<string, number> = {
  nba: 170,
  wnba: 130,
};

// Nombre de tours de pré-saison (chaque tour = 1 match par équipe, sauf
// équipe au repos si nombre impair) et étalement en jours avant l'ouverture
// de la saison régulière — même esprit que les vrais camps d'entraînement /
// matchs de pré-saison NBA/WNBA, mais volontairement simple (pas besoin d'un
// calendrier équilibré pour des matchs qui ne comptent pour rien).
export const PRESEASON_ROUNDS = 5;
export const PRESEASON_SPAN_DAYS = 12;

// Suffixe qui garde les matchs de pré-saison hors du champ des requêtes de
// saison régulière (classement, calendrier, stats, date limite des
// échanges) sans aucune modification de ces requêtes — même convention que
// les matchs de playoffs (voir playoffSeason() dans data-access/playoffs.ts).
export function preseasonSeasonLabel(regularSeason: string): string {
  return `${regularSeason}-preseason`;
}

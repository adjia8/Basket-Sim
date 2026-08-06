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

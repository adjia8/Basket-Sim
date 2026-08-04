// Valeur d'échange d'un joueur : son overallRating, cohérent avec le barème de
// salaire déjà basé dessus (src/lib/careers/generate-contracts.ts) — pas besoin
// d'une deuxième échelle.
export function tradeValue(overallRating: number): number {
  return overallRating;
}

// L'IA accepte si la valeur qu'elle reçoit vaut au moins 90% de ce qu'elle donne.
// Assez permissif pour rester jouable, assez strict pour bloquer les échanges
// absurdes (ex: un joueur de banc contre une superstar).
export const TRADE_ACCEPT_TOLERANCE = 0.9;

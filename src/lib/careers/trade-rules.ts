// Valeur d'échange d'un joueur : son overallRating, cohérent avec le barème de
// salaire déjà basé dessus (src/lib/careers/generate-contracts.ts) — pas besoin
// d'une deuxième échelle.
export function tradeValue(overallRating: number): number {
  return overallRating;
}

// Valeur d'échange réaliste (utilisée par l'IA pour juger un échange) : elle
// croît de plus en plus vite avec la note — une star de 92 vaut bien plus que
// deux joueurs de 75 (avec l'ancienne somme des notes, on pouvait arracher
// une star à l'IA contre deux remplaçants). Bonus de jeunesse, décote des
// vétérans.
export function playerTradeValue(overallRating: number, age: number): number {
  const base = Math.pow(Math.max(0, overallRating - 55), 1.8);
  const ageFactor = age <= 22 ? 1.15 : age <= 25 ? 1.05 : age >= 34 ? 0.75 : age >= 31 ? 0.9 : 1;
  return Math.round(base * ageFactor);
}

// Un pick sur la même échelle que playerTradeValue (via sa valeur 55-82).
export function pickTradeValue(round: number, pickNumber: number | null, picksPerRound: number): number {
  return Math.round(Math.pow(Math.max(0, draftPickTradeValue(round, pickNumber, picksPerRound) - 55), 1.8));
}

// Valeur d'échange d'un pick de draft, sur la même échelle que tradeValue
// (0-99), calée sur la plage réelle des prospects générés (55-82, voir
// generate-prospects.ts) — décroissante du 1er pick du 1er tour (le plus
// valorisé) au dernier pick du 2e tour. Pour un pick futur pas encore résolu
// (pickNumber inconnu), utilise la valeur moyenne du tour concerné.
const PICK_VALUE_MAX = 82;
const PICK_VALUE_MIN = 55;

export function draftPickTradeValue(
  round: number,
  pickNumber: number | null,
  picksPerRound: number
): number {
  const totalPicks = picksPerRound * 2;
  const valueAtPosition = (position: number) => {
    const t = totalPicks > 1 ? (position - 1) / (totalPicks - 1) : 0;
    return PICK_VALUE_MAX - t * (PICK_VALUE_MAX - PICK_VALUE_MIN);
  };
  if (pickNumber === null) {
    const roundStart = round === 1 ? 1 : picksPerRound + 1;
    const roundEnd = round === 1 ? picksPerRound : totalPicks;
    return Math.round(valueAtPosition((roundStart + roundEnd) / 2));
  }
  return Math.round(valueAtPosition(pickNumber));
}

// L'IA accepte si la valeur qu'elle reçoit vaut au moins 90% de ce qu'elle donne.
// Assez permissif pour rester jouable, assez strict pour bloquer les échanges
// absurdes (ex: un joueur de banc contre une superstar).
export const TRADE_ACCEPT_TOLERANCE = 0.9;

// Date limite des échanges : pas de vraie horloge murale dans ce jeu (le temps
// n'avance qu'au fil des matchs simulés), donc calée sur la progression de la
// saison en cours plutôt que sur une date — comme la vraie date limite NBA,
// qui tombe aux alentours des deux tiers de la saison régulière.
export const TRADE_DEADLINE_SEASON_FRACTION = 0.65;

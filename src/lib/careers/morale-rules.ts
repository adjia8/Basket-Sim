// Règles pures du moral individuel des joueurs, façon Football Manager —
// aucun accès base de données ici (voir data-access/morale.ts et press.ts).
//
// Le moral bouge surtout avec ce que le GM dit des joueurs en conférence de
// presse (éloges, critiques, réponses sur une demande de transfert…), un peu
// avec les résultats, et revient lentement vers la normale. Il pèse sur le
// rendement en match (quelques %) et, très bas, pousse à demander un
// transfert.

export const MORALE_NEUTRAL = 60;
// En dessous, le joueur est malheureux au point de pouvoir demander à partir
// (voir tradeRequestReasons dans player-demands.ts).
export const MORALE_TRADE_REQUEST_THRESHOLD = 25;

export type MoraleLevel = "superb" | "good" | "okay" | "poor" | "abysmal";

export function clampMorale(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}

export function moraleLevel(morale: number): MoraleLevel {
  if (morale >= 80) return "superb";
  if (morale >= 65) return "good";
  if (morale >= 45) return "okay";
  if (morale >= MORALE_TRADE_REQUEST_THRESHOLD) return "poor";
  return "abysmal";
}

// Rendement en match : jusqu'à +4 % pour un moral au plus haut, jusqu'à -6 %
// pour un joueur au fond du trou (un joueur malheureux pèse plus qu'un
// joueur heureux n'apporte).
export function moraleImpactFactor(morale: number): number {
  const m = Math.max(0, Math.min(99, morale));
  return m >= MORALE_NEUTRAL
    ? 1 + ((m - MORALE_NEUTRAL) / (99 - MORALE_NEUTRAL)) * 0.04
    : 1 - ((MORALE_NEUTRAL - m) / MORALE_NEUTRAL) * 0.06;
}

// Évolution après un match :
// - les joueurs qui ont joué gagnent 1 point après une victoire (jusqu'à 75)
//   et en perdent 1 après une défaite (jusqu'à 45) : les résultats seuls ne
//   font jamais sortir de la zone « correcte / bonne » ;
// - un joueur renommé cantonné au banc (< 15 min alors qu'il était
//   disponible) perd 1 point ;
// - au-delà de 75 ou en deçà de 45 (conférences de presse), retour d'un
//   point par match vers la normale.
export function moraleAfterGame(params: {
  morale: number;
  played: boolean;
  won: boolean;
  minutes: number;
  renown: number;
}): number {
  let m = params.morale;
  if (params.played) {
    if (params.won && m < 75) m += 1;
    if (!params.won && m > 45) m -= 1;
  }
  if (params.renown >= 70 && params.minutes < 15) m -= 1;
  if (m > 75) m -= 1;
  else if (m < 45) m += 1;
  return clampMorale(m);
}

// Coupure estivale : le moral revient à mi-chemin de la normale.
export function moraleAfterSummer(morale: number): number {
  return clampMorale(MORALE_NEUTRAL + (morale - MORALE_NEUTRAL) / 2);
}

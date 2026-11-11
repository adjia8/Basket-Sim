// Règles pures de la négociation de contrat, façon Football Manager — aucun
// accès base de données ici (voir src/lib/data-access/negotiations.ts).
//
// Le joueur (son agent) a une position : un salaire plancher caché, une
// demande d'ouverture affichée, une durée et une option préférées, et une
// patience limitée. Le GM propose salaire + durée + option ; le joueur
// accepte, contre-propose (en cédant un peu à chaque tour) ou claque la
// porte si on l'insulte trop souvent.

import { SALARY_RANGES } from "./salary-rules";
import { minAcceptableSalary } from "./player-demands";
import { EXTENSION_MAX_OFFER_YEARS, EXTENSION_MIN_OFFER_YEARS } from "./contract-type-rules";

export type ContractOption = "none" | "player" | "team";
export const CONTRACT_OPTIONS: ContractOption[] = ["none", "player", "team"];

// Une option porte sur la dernière année : impossible sur un contrat d'un an.
export function optionAllowed(option: ContractOption, years: number): boolean {
  return option === "none" || years >= 2;
}

// Jours de jeu pendant lesquels un joueur qui a claqué la porte refuse de
// reparler à ce GM.
export const WALKOUT_COOLDOWN_DAYS = 10;

export interface PlayerStance {
  minSalary: number; // caché : en dessous, jamais d'accord
  askSalary: number; // demande d'ouverture affichée
  preferredYears: number;
  preferredOption: ContractOption;
  patience: number; // tours de contre-proposition avant de partir
}

function roundSalary(value: number): number {
  return Math.round(value / 10_000) * 10_000;
}

export function playerStance(params: {
  renown: number;
  overallRating: number;
  age: number;
  potential: number;
  leagueId: string;
  // Extension : moral du joueur (0-100). Agent libre : null.
  morale: number | null;
  // Attractivité de l'équipe (0-1) : bilan, marché, infrastructures.
  teamAppeal: number;
  // Contrat rookie : aucun levier, accepte tout salaire valide.
  rookieScale?: boolean;
}): PlayerStance {
  const range = SALARY_RANGES[params.leagueId] ?? SALARY_RANGES.nba;
  const age = params.age;
  const gap = params.potential - params.overallRating;
  const preferredYears = age >= 31 ? 4 : age >= 29 ? 3 : age <= 24 && gap >= 4 ? 2 : 4;
  const preferredOption: ContractOption = age <= 28 && params.renown >= 60 ? "player" : "none";

  if (params.rookieScale) {
    return { minSalary: range.min, askSalary: range.min, preferredYears, preferredOption: "none", patience: 9 };
  }

  const floor = minAcceptableSalary(params.renown, params.overallRating, params.leagueId);
  // Un joueur heureux chez toi (ou attiré par ton projet) fait un effort ;
  // un joueur mécontent fait payer son mécontentement.
  const moraleAdj = params.morale === null ? 0 : params.morale >= 70 ? -0.05 : params.morale <= 35 ? 0.1 : 0;
  const appealAdj = (0.5 - Math.max(0, Math.min(1, params.teamAppeal))) * 0.1; // -5 % à +5 %
  const minSalary = Math.max(range.min, Math.min(range.max, roundSalary(floor * (1 + moraleAdj + appealAdj))));
  const askSalary = Math.max(minSalary, Math.min(range.max, roundSalary(minSalary * (1.12 + (params.renown / 99) * 0.1))));
  const patience = params.renown >= 70 ? 2 : 3;
  return { minSalary, askSalary, preferredYears, preferredOption, patience };
}

export interface Offer {
  salary: number;
  years: number;
  option: ContractOption;
}

// Valeur perçue par le joueur : un salaire, corrigé de l'écart à la durée
// voulue et de l'option (une option joueur lui donne de la liberté, une
// option d'équipe lui retire de la sécurité).
export function perceivedValue(stance: PlayerStance, offer: Offer): number {
  const yearsGap = Math.abs(offer.years - stance.preferredYears);
  const optionMult = offer.option === "player" ? 1.06 : offer.option === "team" ? 0.92 : 1;
  const preferenceMiss = stance.preferredOption === "player" && offer.option !== "player" ? 0.97 : 1;
  return offer.salary * (1 - 0.04 * yearsGap) * optionMult * preferenceMiss;
}

export type NegotiationVerdict =
  | { kind: "accept" }
  | { kind: "counter"; counter: Offer; patienceLeft: number }
  | { kind: "walk" };

// Contre-proposition : sa durée et son option préférées, à un salaire qui
// descend de la demande d'ouverture vers son plancher à mesure que la
// patience s'use. Toujours acceptable par lui-même (valeur ≥ plancher).
export function counterOffer(stance: PlayerStance, patienceLeft: number): Offer {
  const share = stance.patience > 0 ? Math.max(0, patienceLeft) / stance.patience : 0;
  const target = stance.minSalary + (stance.askSalary - stance.minSalary) * share;
  const base: Offer = { salary: 0, years: stance.preferredYears, option: stance.preferredOption };
  // Ramène la valeur perçue à `target` (le multiplicateur de sa propre
  // préférence vaut ≥ 1, donc arrondir au-dessus suffit).
  const unit = perceivedValue(stance, { ...base, salary: 1 });
  return { ...base, salary: Math.ceil(target / unit / 10_000) * 10_000 };
}

export function evaluateOffer(stance: PlayerStance, offer: Offer, patienceLeft: number): NegotiationVerdict {
  const value = perceivedValue(stance, offer);
  if (value >= stance.minSalary) return { kind: "accept" };
  // Une offre très en dessous (moins de 80 % du plancher) agace deux fois plus.
  const cost = value < stance.minSalary * 0.8 ? 2 : 1;
  const left = patienceLeft - cost;
  if (left < 0) return { kind: "walk" };
  return { kind: "counter", counter: counterOffer(stance, left), patienceLeft: left };
}

export function validOffer(offer: Offer, leagueId: string): boolean {
  const range = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  return (
    Number.isFinite(offer.salary) &&
    offer.salary >= range.min &&
    offer.salary <= range.max &&
    Number.isInteger(offer.years) &&
    offer.years >= EXTENSION_MIN_OFFER_YEARS &&
    offer.years <= EXTENSION_MAX_OFFER_YEARS &&
    CONTRACT_OPTIONS.includes(offer.option) &&
    optionAllowed(offer.option, offer.years)
  );
}

// Attractivité d'une équipe pour un joueur (0-1) : bilan, marché, installations.
export function teamAppeal(winPct: number, marketAppeal: number, facilitiesLevel: number): number {
  return Math.max(0, Math.min(1, winPct * 0.5 + (marketAppeal / 100) * 0.25 + (facilitiesLevel / 100) * 0.25));
}

// ---------------------------------------------------------------------------
// Options à l'intersaison (dernière année du contrat sur le point de commencer)

// Option joueur : il la refuse (et devient agent libre) s'il vaut nettement
// plus sur le marché, ou s'il est malheureux.
export function playerOptsOut(params: { marketSalary: number; salary: number; morale: number }): boolean {
  return params.marketSalary > params.salary * 1.1 || params.morale <= 30;
}

// Option d'équipe côté IA : refusée si le joueur est nettement surpayé.
export function aiDeclinesTeamOption(params: { marketSalary: number; salary: number }): boolean {
  return params.salary > params.marketSalary * 1.3;
}

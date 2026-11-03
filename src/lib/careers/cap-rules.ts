// Règles pures du plafond salarial — aucun accès base de données ici.
//
// WNBA : plafond strict (vraie règle WNBA) — aucune transaction ne peut
// faire dépasser League.salaryCap.
//
// NBA : plafond « souple », version simplifiée de la vraie convention
// 2026-27 (chiffres officiels pr.nba.com) :
// - au-dessus du plafond, un agent libre ne peut signer qu'au salaire
//   minimum (exception vétéran) ;
// - un échange au-dessus du plafond doit équilibrer les salaires (on reçoit
//   au plus 125 % de ce qu'on envoie, + 250 000 $) ;
// - prolonger ses propres joueurs ou drafter reste possible au-dessus du
//   plafond (droits Bird, échelle rookie) ;
// - le 2e apron est une limite stricte pour tout ajout de salaire ;
// - au-delà de la ligne de taxe, une taxe de luxe est prélevée en fin de
//   saison sur la trésorerie (ramenée à l'échelle du budget du jeu).

export const NBA_TAX_LINE = 200_428_000;
export const NBA_SECOND_APRON = 221_686_000;
// Plus haut salaire minimum (vétéran 10+ ans) : seule signature possible
// d'un agent libre une fois au-dessus du plafond.
export const NBA_MINIMUM_EXCEPTION = 3_876_529;
const TRADE_MATCHING_RATIO = 1.25;
const TRADE_MATCHING_CUSHION = 250_000;
// Taux unique simplifié (la vraie taxe est progressive, de 1,5 à 3,75 $
// par dollar au-dessus de la ligne).
export const LUXURY_TAX_RATE = 1.5;
// La trésorerie du jeu est un budget de gestion (~4 M$ de revenus par
// saison, voir finance-rules.ts), pas le vrai chiffre d'affaires d'une
// franchise (~400 M$) : la vraie taxe y serait ruineuse dès la première
// saison. Ramenée à cette échelle, une équipe collée au 2e apron paie
// environ un quart d'une saison de revenus.
const TAX_BUDGET_SCALE = 1 / 30;

export type SalaryMove = "sign" | "promote" | "extend" | "draft";

export type CapVerdict =
  | { ok: true }
  | { ok: false; reason: "hard_cap"; limit: number }
  | { ok: false; reason: "minimum_only"; limit: number }
  | { ok: false; reason: "apron"; limit: number }
  | { ok: false; reason: "salary_matching"; limit: number };

function isSoftCap(leagueId: string): boolean {
  return leagueId === "nba";
}

// Ajout de salaire hors échange : signature d'un agent libre, passage
// two-way → standard, prolongation, choix de draft. `payrollAfter` inclut
// déjà le nouveau salaire (et retire l'ancien en cas de prolongation).
export function checkSalaryMove(
  leagueId: string,
  salaryCap: number,
  move: SalaryMove,
  payrollAfter: number,
  salary: number
): CapVerdict {
  if (!isSoftCap(leagueId)) {
    return payrollAfter <= salaryCap ? { ok: true } : { ok: false, reason: "hard_cap", limit: salaryCap };
  }
  if (payrollAfter > NBA_SECOND_APRON) return { ok: false, reason: "apron", limit: NBA_SECOND_APRON };
  if (payrollAfter <= salaryCap) return { ok: true };
  if (move === "extend" || move === "draft") return { ok: true };
  return salary <= NBA_MINIMUM_EXCEPTION
    ? { ok: true }
    : { ok: false, reason: "minimum_only", limit: NBA_MINIMUM_EXCEPTION };
}

// Un côté d'un échange : masse avant, salaires envoyés/reçus.
export function checkTradeSide(
  leagueId: string,
  salaryCap: number,
  payrollBefore: number,
  salaryOut: number,
  salaryIn: number
): CapVerdict {
  const payrollAfter = payrollBefore - salaryOut + salaryIn;
  if (!isSoftCap(leagueId)) {
    return payrollAfter <= salaryCap ? { ok: true } : { ok: false, reason: "hard_cap", limit: salaryCap };
  }
  // Un échange qui ne fait pas monter la masse est toujours permis, même
  // au-dessus des seuils (sinon une équipe déjà chère serait bloquée à vie).
  if (salaryIn <= salaryOut || payrollAfter <= salaryCap) return { ok: true };
  if (payrollAfter > NBA_SECOND_APRON) return { ok: false, reason: "apron", limit: NBA_SECOND_APRON };
  const maxIncoming = salaryOut * TRADE_MATCHING_RATIO + TRADE_MATCHING_CUSHION;
  return salaryIn <= maxIncoming
    ? { ok: true }
    : { ok: false, reason: "salary_matching", limit: Math.round(maxIncoming) };
}

// Taxe de luxe prélevée sur la trésorerie en fin de saison (0 sous la
// ligne, ou en WNBA), à l'échelle du budget du jeu.
export function luxuryTax(leagueId: string, payroll: number): number {
  if (!isSoftCap(leagueId)) return 0;
  return Math.round(Math.max(0, payroll - NBA_TAX_LINE) * LUXURY_TAX_RATE * TAX_BUDGET_SCALE);
}

// Seuil d'alerte affiché (masse salariale « dans le rouge ») : la ligne de
// taxe en NBA (le plafond y est normalement dépassé), le plafond en WNBA.
export function payrollWarningLine(leagueId: string, salaryCap: number): number {
  return isSoftCap(leagueId) ? NBA_TAX_LINE : salaryCap;
}

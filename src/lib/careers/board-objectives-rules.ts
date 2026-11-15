// Objectifs des propriétaires en cours de saison (façon Football Manager) —
// règles pures, sans accès base de données (voir board-objectives.ts).
//
// Après une quinzaine de matchs, la direction fixe deux objectifs adaptés à
// la situation de l'équipe : un objectif de résultats (calé sur le niveau
// montré jusque-là) et, selon l'effectif, faire jouer les jeunes ou remplir
// la salle. Ils sont jugés à la fin de la saison régulière et pèsent sur la
// confiance de la direction (frontOfficeApproval), donc sur l'évaluation du
// GM en fin de saison.

export type BoardObjectiveType = "win_pct" | "develop_youth" | "attendance";

export interface BoardObjective {
  type: BoardObjectiveType;
  target: number; // win_pct et develop_youth : fraction (0-1) ; attendance : 0-99
  status: "active" | "met" | "failed";
}

export interface BoardObjectives {
  season: string;
  objectives: BoardObjective[];
}

export const BOARD_OBJECTIVES_AFTER_GAMES = 15;
export const YOUTH_AGE = 23;
export const APPROVAL_IF_MET = 6;
export const APPROVAL_IF_FAILED = -8;

export function parseBoardObjectives(json: string | null | undefined): BoardObjectives | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as BoardObjectives;
  } catch {
    return null;
  }
}

export function chooseBoardObjectives(params: {
  winPct: number;
  youngPlayers: number; // joueurs de 23 ans et moins dans l'effectif
  attendance: number;
}): BoardObjective[] {
  // Résultats : tenir le niveau montré (arrondi aux 5 %), borné à 35-65 %.
  const winTarget = Math.max(0.35, Math.min(0.65, Math.round(params.winPct * 20) / 20));
  const objectives: BoardObjective[] = [{ type: "win_pct", target: winTarget, status: "active" }];
  if (params.youngPlayers >= 2) {
    // Au moins 20 % des minutes de l'équipe pour les 23 ans et moins.
    objectives.push({ type: "develop_youth", target: 0.2, status: "active" });
  } else {
    objectives.push({ type: "attendance", target: Math.min(95, Math.round(params.attendance) + 5), status: "active" });
  }
  return objectives;
}

export function objectiveMet(o: BoardObjective, actual: number): boolean {
  return actual >= o.target;
}

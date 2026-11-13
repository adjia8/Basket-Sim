// Règles pures des trophées et distinctions — aucun accès base de données
// ici (voir data-access/awards.ts). Les formules s'inspirent de ce que
// récompensent les votes réels : production complète et bilan collectif
// pour le MVP, impact défensif pour le défenseur de l'année, etc.

import type { Locale } from "@/lib/i18n/locale";

export type AwardType =
  | "mvp"
  | "dpoy"
  | "roy"
  | "sixth_man"
  | "mip"
  | "coach"
  | "all_nba_1"
  | "all_nba_2"
  | "all_nba_3"
  | "all_star"
  | "all_star_mvp"
  | "nba_cup"
  | "cup_mvp";

export const MAJOR_AWARDS: AwardType[] = ["mvp", "dpoy", "roy", "sixth_man", "mip", "coach"];
export const ALL_NBA: AwardType[] = ["all_nba_1", "all_nba_2", "all_nba_3"];

// Ligne de stats utilisée par les formules (moyennes par match).
export interface AwardLine {
  playerId: string;
  teamId: string;
  gamesPlayed: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
  fgPct: number;
  defense: number; // moyenne des attributs défensifs (0-99)
}

// Éligibilité : au moins la moitié des matchs joués par le plus assidu.
export function minGamesForAwards(lines: { gamesPlayed: number }[]): number {
  const max = lines.reduce((m, l) => Math.max(m, l.gamesPlayed), 0);
  return Math.ceil(max * 0.5);
}

function production(l: AwardLine): number {
  return l.ppg + 1.2 * l.rpg + 1.5 * l.apg + 2 * (l.spg + l.bpg) - l.tpg + (l.fgPct - 45) * 0.2;
}

export function mvpScore(l: AwardLine, teamWinPct: number): number {
  return production(l) * (0.6 + teamWinPct);
}

export function allStarScore(l: AwardLine, teamWinPct: number): number {
  return production(l) * (0.8 + 0.4 * teamWinPct);
}

export function dpoyScore(l: AwardLine, teamWinPct: number): number {
  return (2.2 * l.spg + 2.2 * l.bpg + 0.35 * l.rpg + (l.defense - 60) * 0.1) * (0.8 + 0.4 * teamWinPct);
}

export function rookieScore(l: AwardLine): number {
  return l.ppg + 0.8 * l.rpg + l.apg + l.spg + l.bpg;
}

export function sixthManScore(l: AwardLine): number {
  return l.ppg + 0.5 * (l.rpg + l.apg);
}

// Progression : écart de production avec la saison précédente.
export function improvementScore(current: AwardLine, previous: AwardLine): number {
  return current.ppg - previous.ppg + 0.5 * (current.rpg - previous.rpg + current.apg - previous.apg);
}

// Entraîneur de l'année : l'équipe qui dépasse le plus ce que laissait
// attendre son effectif (rang de force en début d'évaluation).
export function expectedWinPct(strengthRank: number, teamCount: number): number {
  if (teamCount <= 1) return 0.5;
  return 0.72 - ((strengthRank - 1) / (teamCount - 1)) * 0.44;
}

// Retombées : renommée et moral des lauréats.
export const AWARD_EFFECTS: Record<AwardType, { renown: number; morale: number }> = {
  mvp: { renown: 8, morale: 6 },
  dpoy: { renown: 5, morale: 5 },
  roy: { renown: 5, morale: 5 },
  sixth_man: { renown: 3, morale: 4 },
  mip: { renown: 4, morale: 4 },
  coach: { renown: 0, morale: 0 },
  all_nba_1: { renown: 4, morale: 3 },
  all_nba_2: { renown: 3, morale: 2 },
  all_nba_3: { renown: 2, morale: 2 },
  all_star: { renown: 3, morale: 3 },
  all_star_mvp: { renown: 3, morale: 3 },
  nba_cup: { renown: 0, morale: 0 }, // trophée d'équipe : moral de tout l'effectif, voir nba-cup.ts
  cup_mvp: { renown: 3, morale: 4 },
};

export function statLine(l: AwardLine, locale: Locale): string {
  const f = (v: number) => v.toFixed(1).replace(".", locale === "fr" ? "," : ".");
  return locale === "fr"
    ? `${f(l.ppg)} pts · ${f(l.rpg)} reb · ${f(l.apg)} pas`
    : `${f(l.ppg)} pts · ${f(l.rpg)} reb · ${f(l.apg)} ast`;
}

// Saison régulière seulement (les libellés de playoffs/pré-saison ont un suffixe).
export function isRegularSeason(season: string): boolean {
  return /^\d{4}-\d{4}$/.test(season);
}

// Proportion de la saison régulière jouée à partir de laquelle les
// All-Stars sont désignés (mi-février en NBA).
export const ALL_STAR_SEASON_FRACTION = 0.55;

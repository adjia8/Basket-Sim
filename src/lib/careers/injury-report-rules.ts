// Infirmerie de la ligue — règles pures (importance des joueurs blessés,
// blessures notables, date de retour estimée), sans accès base de données.

export type InjuryTier = "star" | "starter" | "role";
export const INJURY_TIERS: InjuryTier[] = ["star", "starter", "role"];

// Importance du joueur : star (All-Star / franchise), titulaire, rotation.
export function injuryTier(overall: number, renown: number): InjuryTier {
  if (overall >= 82 || renown >= 80) return "star";
  if (overall >= 75 || renown >= 65) return "starter";
  return "role";
}

// Blessure qui fait l'actualité dans toute la ligue : une star absente
// longtemps (grave, ou au moins 8 matchs).
export function isNotableInjury(p: { overall: number; renown: number; severity: string; gamesOut: number }): boolean {
  return injuryTier(p.overall, p.renown) === "star" && (p.severity === "severe" || p.gamesOut >= 8);
}

const TIER_RANK: Record<InjuryTier, number> = { star: 0, starter: 1, role: 2 };

export interface InjuredPlayerSort {
  tier: InjuryTier;
  gamesRemaining: number;
  overall: number;
}

// Les plus importants d'abord, puis les absences les plus longues.
export function sortInjured<T extends InjuredPlayerSort>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.gamesRemaining - a.gamesRemaining || b.overall - a.overall
  );
}

// Date de retour estimée : le match qui suit les `gamesRemaining` matchs
// manqués, d'après le calendrier à venir de l'équipe (dates triées). Null si
// la saison se termine avant.
export function estimatedReturn(upcomingGameDates: string[], gamesRemaining: number): string | null {
  return upcomingGameDates[Math.max(0, gamesRemaining)] ?? null;
}

// Règles pures de fatigue — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/fatigue.ts.

// Gain de fatigue après un match joué, plus faible pour une bonne `stamina`.
// À stamina 99 : +12. À stamina 0 : +30.
export function fatigueGainForGame(stamina: number): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  return Math.round(30 - t * 18);
}

// Récupération avant le prochain match, proportionnelle aux jours de repos
// réels (désormais fiables — voir la Phase A de generate-schedule.ts) et à la
// `stamina` : un jour de repos à stamina 99 récupère plus qu'à stamina 0.
export function fatigueRecoveryForRestDays(restDays: number, stamina: number): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  const perDay = 10 + t * 8; // 10 à stamina 0, 18 à stamina 99
  return Math.round(Math.max(0, restDays) * perDay);
}

// Règles pures de fatigue — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/fatigue.ts.

// Gain de fatigue après un match joué, plus faible pour une bonne `stamina`.
// À stamina 99 : +12. À stamina 0 : +30.
export function fatigueGainForGame(stamina: number): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  return Math.round(30 - t * 18);
}

// Récupération avant le prochain match, proportionnelle aux jours de repos
// réels (fiables depuis la correction du générateur de calendrier) et à la
// `stamina` : un jour de repos à stamina 99 récupère plus qu'à stamina 0.
// `facilitiesLevel` (0-100, 50 = neutre) module la récupération de ±20% — de
// meilleures infrastructures d'entraînement accélèrent la récupération.
export function fatigueRecoveryForRestDays(
  restDays: number,
  stamina: number,
  facilitiesLevel = 50
): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  const perDay = 10 + t * 8; // 10 à stamina 0, 18 à stamina 99
  const facilitiesFactor = 1 + ((Math.max(0, Math.min(100, facilitiesLevel)) - 50) / 50) * 0.2;
  return Math.round(Math.max(0, restDays) * perDay * facilitiesFactor);
}

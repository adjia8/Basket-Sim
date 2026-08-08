// Règles pures de renommé — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/renown.ts.

// Valeur de départ dérivée de l'overall : les meilleurs joueurs démarrent déjà
// réputés, mais personne ne démarre au maximum — le renommé se gagne ensuite
// par les stats réalisées en carrière (voir renownDeltaForGame).
export function initialRenown(overallRating: number): number {
  return Math.max(10, Math.min(95, Math.round(overallRating * 0.85)));
}

// Production "attendue" pour un joueur de cet overall — repère grossier pour
// juger une performance de match (points + rebonds*1.2 + passes*1.5).
function expectedProduction(overallRating: number): number {
  return (overallRating / 99) * 30;
}

// Delta de renommé après un match, borné pour qu'aucun match seul ne
// bouleverse la note — c'est l'accumulation sur la saison qui fait la
// tendance.
export function renownDeltaForGame(
  entry: { points: number; rebounds: number; assists: number },
  overallRating: number
): number {
  const production = entry.points + entry.rebounds * 1.2 + entry.assists * 1.5;
  const ratio = production / Math.max(expectedProduction(overallRating), 8);
  return Math.max(-1.5, Math.min(1.5, (ratio - 1) * 2));
}

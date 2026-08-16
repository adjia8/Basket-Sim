// Règles pures d'affluence — aucun accès base de données ici, tout est
// piloté par src/lib/data-access/team-state.ts.

// Cible que l'affluence approche lentement match après match : le bilan
// domine (demande explicite — "évoluant en fonction des résultats"),
// l'attractivité de marché et la qualité des infrastructures ne font que
// moduler légèrement. Même esprit que chemistryTarget (chemistry-rules.ts).
export function attendanceTarget(winPct: number, marketAppeal: number, facilitiesLevel: number): number {
  const target = 20 + winPct * 60 + marketAppeal * 0.15 + facilitiesLevel * 0.05;
  return Math.max(5, Math.min(99, target));
}

// Dérive vers la cible (8% de l'écart par match, un peu plus réactif que la
// chimie à 5% — les fans suivent une série de plus près que la cohésion
// d'équipe). Même garde-fou que nextChemistry : au moins un point de
// progression par match tant que la cible n'est pas atteinte.
export function nextAttendance(current: number, target: number): number {
  const diff = target - current;
  if (diff === 0) return current;
  const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.08));
  return Math.max(0, Math.min(99, current + step));
}

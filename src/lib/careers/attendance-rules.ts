// Règles pures d'affluence — aucun accès base de données ici, tout est
// piloté par src/lib/data-access/team-state.ts.

// Pouvoir d'attraction des stars (0-1) : seuls les joueurs très connus
// (renommée ≥ 70) déplacent le public ; la plus grande star compte
// pleinement, la deuxième de moitié, la troisième d'un quart. Une
// superstar seule (renommée 95+) suffit presque à saturer l'indice.
export const STAR_RENOWN_FLOOR = 70;
export function starPower(renowns: number[]): number {
  const weights = [1, 0.5, 0.25];
  const top = [...renowns].sort((a, b) => b - a).slice(0, weights.length);
  const power = top.reduce((sum, r, i) => sum + (Math.max(0, r - STAR_RENOWN_FLOOR) / (99 - STAR_RENOWN_FLOOR)) * weights[i], 0);
  return Math.min(1, power);
}

// Cible que l'affluence approche lentement match après match : le bilan
// domine (demande explicite — "évoluant en fonction des résultats"), avec
// une part de forme récente (10 derniers matchs : une série de victoires
// remplit la salle avant que le bilan global ne bouge) ; les stars de
// l'effectif ajoutent jusqu'à +12 points ; l'attractivité de marché et la
// qualité des infrastructures ne font que moduler légèrement. Même esprit
// que chemistryTarget (chemistry-rules.ts).
export function attendanceTarget(
  winPct: number,
  marketAppeal: number,
  facilitiesLevel: number,
  stars = 0,
  recentWinPct: number = winPct
): number {
  const results = winPct * 0.7 + recentWinPct * 0.3;
  const target = 18 + results * 58 + stars * 12 + marketAppeal * 0.15 + facilitiesLevel * 0.05;
  return Math.max(5, Math.min(99, target));
}

// Effet d'un soir de match sur le taux de remplissage (multiplicateur) :
// les stars de l'équipe présentes attirent, celles absentes (blessées, au
// repos) font fuir une partie du public venu pour elles, et une star
// adverse fait aussi vendre des billets.
export function nightStarFactor(homeAvailable: number, homeMissing: number, awayAvailable: number): number {
  return 1 + homeAvailable * 0.06 - homeMissing * 0.1 + awayAvailable * 0.06;
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

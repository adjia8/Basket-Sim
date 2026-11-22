// Qualité réelle des installations NBA (novembre 2026), notée sur 5.
//
// Sources :
// - Salles : classement ESPN 2024-25 des salles NBA (accès, restauration,
//   équipements, expérience des fans) ; Intuit Dome (Clippers, 2024) hors
//   classement faute de recul, noté d'après sa réputation.
// - Centres d'entraînement : The Athletic (déc. 2024, « la course aux
//   centres d'entraînement »), Front Office Sports (2020-2023), actualités
//   2025-2026 (centre des Hornets prévu au printemps 2027, centre des Mavericks
//   rénové en septembre 2026). Heat et Nuggets s'entraînent encore dans
//   leur salle (« tout en bas » d'un classement objectif).
// - `medical` : centre adossé à un grand hôpital partenaire (Henry Ford,
//   Cleveland Clinic, Froedtert, Emory…) → centre médical mieux noté.

export interface RealFacilities {
  training: number; // 1-5
  arena: number; // 1-5
  medical?: number; // bonus (en étoiles) sur le centre médical
}

export const NBA_FACILITIES: Record<string, RealFacilities> = {
  atl: { training: 4, arena: 3, medical: 0.5 },
  bos: { training: 4, arena: 4.5 },
  bkn: { training: 3.5, arena: 4 },
  cha: { training: 2, arena: 2 },
  chi: { training: 3.5, arena: 3.5 },
  cle: { training: 3.5, arena: 3, medical: 1 },
  dal: { training: 3.5, arena: 3.5 },
  den: { training: 1.5, arena: 2.5 },
  det: { training: 5, arena: 4, medical: 0.5 },
  gsw: { training: 4.5, arena: 5 },
  hou: { training: 4.5, arena: 2.5 },
  ind: { training: 4, arena: 4 },
  lac: { training: 5, arena: 5 },
  lal: { training: 4, arena: 4 },
  mem: { training: 2.5, arena: 2 },
  mia: { training: 1.5, arena: 3.5 },
  mil: { training: 4, arena: 4, medical: 0.5 },
  min: { training: 3, arena: 3.5 },
  nop: { training: 3, arena: 2 },
  nyk: { training: 2.5, arena: 4.5 },
  okc: { training: 3, arena: 3 },
  orl: { training: 5, arena: 2.5 },
  phi: { training: 4, arena: 2.5 },
  phx: { training: 4, arena: 3 },
  por: { training: 2, arena: 3 },
  sac: { training: 3, arena: 5 },
  sas: { training: 4.5, arena: 1.5 },
  tor: { training: 3.5, arena: 4 },
  uta: { training: 4, arena: 3.5 },
  was: { training: 3, arena: 2 },
};

// Niveau global de départ (0-99) correspondant à une note sur 5.
export function levelFromStars(stars: number): number {
  return Math.round(20 + stars * 14); // 1,5 → 41 ; 3 → 62 ; 5 → 90
}

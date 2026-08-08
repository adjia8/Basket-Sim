// Nationalité par défaut pour les joueurs/prospects générés procéduralement
// (agents libres et classes de draft au-delà des données réelles curées) —
// tirage pondéré déterministe (même joueur → même nationalité à chaque
// génération), pas une prétention à l'exactitude, juste une distribution
// internationale crédible (~25% hors États-Unis, proche de la réalité NBA).
const NATIONALITY_POOL: { nationality: string; weight: number }[] = [
  { nationality: "États-Unis", weight: 75 },
  { nationality: "France", weight: 3 },
  { nationality: "Canada", weight: 3 },
  { nationality: "Serbie", weight: 2 },
  { nationality: "Australie", weight: 2 },
  { nationality: "Allemagne", weight: 2 },
  { nationality: "Espagne", weight: 2 },
  { nationality: "Nigeria", weight: 2 },
  { nationality: "Lituanie", weight: 1 },
  { nationality: "République dominicaine", weight: 1 },
  { nationality: "Croatie", weight: 1 },
  { nationality: "Turquie", weight: 1 },
  { nationality: "Grèce", weight: 1 },
  { nationality: "Italie", weight: 1 },
  { nationality: "Slovénie", weight: 1 },
  { nationality: "Cameroun", weight: 1 },
  { nationality: "Sénégal", weight: 1 },
];

const TOTAL_WEIGHT = NATIONALITY_POOL.reduce((sum, entry) => sum + entry.weight, 0);

function seededHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 1000) + 1000) % 1000; // 0..999
}

export function randomNationality(seed: string): string {
  const roll = (seededHash(`${seed}-nationality`) / 1000) * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const entry of NATIONALITY_POOL) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.nationality;
  }
  return "États-Unis";
}

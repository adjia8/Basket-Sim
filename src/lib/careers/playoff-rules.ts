// Règles pures des playoffs — aucun accès base de données ici, tout est
// piloté par src/lib/data-access/playoffs.ts.

export interface RoundSpec {
  round: string;
  bestOf: number;
}

// Bracket à 8 équipes, arbre fixe (pas de reseeding dynamique entre les
// tours) : round-1 = [1v8, 2v7, 3v6, 4v5], puis demi-finales = vainqueur(1v8)
// vs vainqueur(4v5) et vainqueur(2v7) vs vainqueur(3v6), puis la finale.
// Utilisé une fois par conférence pour la NBA, une seule fois pour la WNBA.
export const NBA_CONFERENCE_ROUNDS: RoundSpec[] = [
  { round: "round-1", bestOf: 7 },
  { round: "conf-semis", bestOf: 7 },
  { round: "conf-finals", bestOf: 7 },
];
export const NBA_FINALS_ROUND: RoundSpec = { round: "finals", bestOf: 7 };

// Format WNBA 2025+ : 1er tour best-of-3, demi-finales best-of-5, finale
// best-of-7 (nouveauté 2025). Pas de logique de conférence.
export const WNBA_ROUNDS: RoundSpec[] = [
  { round: "round-1", bestOf: 3 },
  { round: "semifinals", bestOf: 5 },
  { round: "finals", bestOf: 7 },
];

// Appariement standard 1v8, 2v7, 3v6, 4v5 — l'ordre du tableau est l'ordre
// des "slots" du bracket (slot 0 = 1v8, etc.), utilisé par nextRoundPairs
// pour déterminer les tours suivants.
export function seedingPairs<T extends { seed: number }>(seeds: T[]): [T, T][] {
  const sorted = [...seeds].sort((a, b) => a.seed - b.seed);
  const pairs: [T, T][] = [];
  for (let i = 0; i < sorted.length / 2; i++) {
    pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
  }
  return pairs;
}

// Appariement du tour suivant à partir des vainqueurs du tour courant, dans
// l'ordre des slots : vainqueur(slot 0) affronte vainqueur(dernier slot),
// vainqueur(slot 1) affronte vainqueur(avant-dernier), etc. — arbre de
// tournoi standard, sans reseeding.
export function nextRoundPairs<T>(winnersInSlotOrder: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < winnersInSlotOrder.length / 2; i++) {
    pairs.push([winnersInSlotOrder[i], winnersInSlotOrder[winnersInSlotOrder.length - 1 - i]]);
  }
  return pairs;
}

// Nombre de victoires nécessaires pour remporter une série.
export function winsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

// Le mieux classé des deux équipes reçoit-il le match `gameNumber` (1-indexé)
// de cette série ? Motifs domicile/extérieur réels : 1-1-1 (best-of-3, format
// WNBA 2025 — le mieux classé reçoit les matchs 1 et 3), 2-2-1 (best-of-5),
// 2-2-1-1-1 (best-of-7). Le play-in (best-of-1) : le mieux classé reçoit
// toujours.
export function higherSeedHostsGame(gameNumber: number, bestOf: number): boolean {
  switch (bestOf) {
    case 1:
      return true;
    case 3:
      return gameNumber === 1 || gameNumber === 3;
    case 5:
      return gameNumber === 1 || gameNumber === 2 || gameNumber === 5;
    case 7:
      return gameNumber === 1 || gameNumber === 2 || gameNumber === 5 || gameNumber === 7;
    default:
      throw new Error(`Format de série non pris en charge : bestOf=${bestOf}`);
  }
}

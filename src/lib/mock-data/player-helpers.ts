import type { Player, PlayerRatings, Position } from "@/lib/types";

// Petit hash déterministe (basé sur le nom du joueur) pour faire varier les
// sous-ratings autour de l'overall sans dépendre de Math.random() au chargement du module.
function seededVariance(seed: string, spread: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const normalized = ((hash % 1000) + 1000) % 1000; // 0..999
  return Math.round((normalized / 999) * spread * 2 - spread);
}

const POSITION_BIAS: Record<Position, Partial<PlayerRatings>> = {
  PG: { playmaking: 8, scoring: 2, rebounding: -8, defense: -2 },
  SG: { scoring: 6, athleticism: 2, rebounding: -6, playmaking: -2 },
  SF: { scoring: 2, athleticism: 3 },
  PF: { rebounding: 6, defense: 2, playmaking: -6 },
  C: { rebounding: 10, defense: 4, playmaking: -10, athleticism: -2 },
};

function buildRatings(
  overall: number,
  position: Position,
  seed: string
): PlayerRatings {
  const bias = POSITION_BIAS[position];
  const categories: (keyof PlayerRatings)[] = [
    "scoring",
    "playmaking",
    "rebounding",
    "defense",
    "athleticism",
  ];
  const ratings = {} as PlayerRatings;
  for (const category of categories) {
    const variance = seededVariance(`${seed}-${category}`, 6);
    const value = overall + (bias[category] ?? 0) + variance;
    ratings[category] = Math.max(30, Math.min(99, Math.round(value)));
  }
  return ratings;
}

interface PlayerInput {
  id: string;
  teamId: string;
  leagueId: string;
  firstName: string;
  lastName: string;
  position: Position;
  jerseyNumber: number;
  heightCm: number;
  age: number;
  overallRating: number;
}

export function mkPlayer(input: PlayerInput): Player {
  return {
    ...input,
    ratings: buildRatings(input.overallRating, input.position, input.id),
  };
}

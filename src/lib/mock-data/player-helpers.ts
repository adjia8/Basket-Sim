import type { Player, PlayerRatings, Position } from "@/lib/types";
import { initialRenown } from "@/lib/careers/renown-rules";

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
  PG: {
    playmaking: 8,
    scoringOutside: 4,
    basketballIQ: 3,
    scoringInside: -6,
    defenseInside: -8,
    rebounding: -8,
  },
  SG: {
    scoringOutside: 8,
    scoringInside: 2,
    athleticism: 2,
    rebounding: -6,
    playmaking: -2,
    defenseInside: -6,
  },
  SF: { scoringInside: 2, scoringOutside: 2, athleticism: 3, defenseOutside: 1 },
  PF: {
    scoringInside: 8,
    rebounding: 8,
    defenseInside: 4,
    playmaking: -6,
    scoringOutside: -4,
  },
  C: {
    scoringInside: 10,
    defenseInside: 10,
    rebounding: 10,
    playmaking: -10,
    scoringOutside: -8,
    athleticism: -2,
  },
};

// Les attributs mentaux/physiques évoluent avec l'âge indépendamment du poste
// — un vétéran est en général plus malin/clutch mais a moins d'endurance
// qu'un joueur en début de carrière.
function ageAdjustment(category: keyof PlayerRatings, age: number): number {
  if (category === "basketballIQ" || category === "clutch") {
    return age < 23 ? -4 : age < 27 ? 0 : age < 33 ? 3 : 5;
  }
  if (category === "stamina") {
    return age < 27 ? 3 : age < 31 ? 0 : age < 35 ? -5 : -10;
  }
  return 0;
}

const RATING_CATEGORIES: (keyof PlayerRatings)[] = [
  "scoringInside",
  "scoringOutside",
  "playmaking",
  "defenseInside",
  "defenseOutside",
  "rebounding",
  "athleticism",
  "basketballIQ",
  "clutch",
  "stamina",
];

function buildRatings(
  overall: number,
  position: Position,
  age: number,
  seed: string
): PlayerRatings {
  const bias = POSITION_BIAS[position];
  const ratings = {} as PlayerRatings;
  for (const category of RATING_CATEGORIES) {
    const variance = seededVariance(`${seed}-${category}`, 6);
    const value = overall + (bias[category] ?? 0) + ageAdjustment(category, age) + variance;
    ratings[category] = Math.max(30, Math.min(99, Math.round(value)));
  }
  return ratings;
}

// Le risque de blessure croît réellement avec l'âge — sert de valeur par
// défaut pour les joueurs sans historique de blessures notoire connu (voir
// injuryRisk sur PlayerInput ci-dessous).
function defaultInjuryRisk(age: number, seed: string): number {
  const base = age < 23 ? 15 : age < 27 ? 20 : age < 31 ? 28 : age < 35 ? 40 : 55;
  return Math.max(5, Math.min(95, base + seededVariance(`${seed}-injury`, 10)));
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
  // Note 0-99 — omis pour la plupart des joueurs (défaut basé sur l'âge) ;
  // renseigné explicitement pour les joueurs dont l'historique de blessures
  // réel est notoire.
  injuryRisk?: number;
  // Renseignée pour les joueurs dont l'origine internationale est connue
  // (best-effort, non vérifié en direct) ; ces listes ne contiennent que de
  // vrais joueurs identifiables, donc pas de tirage aléatoire ici (contraire-
  // ment aux prospects fictifs générés — voir randomNationality) : défaut
  // "États-Unis" si non renseignée.
  nationality?: string;
}

export function mkPlayer(input: PlayerInput): Player {
  return {
    ...input,
    ratings: buildRatings(input.overallRating, input.position, input.age, input.id),
    injuryRisk: input.injuryRisk ?? defaultInjuryRisk(input.age, input.id),
    injured: false,
    injuryGamesRemaining: 0,
    playingThroughInjury: false,
    renown: initialRenown(input.overallRating),
    fatigue: 0,
    conditioning: 100,
    trainingBoost: 0,
    nationality: input.nationality ?? "États-Unis",
  };
}

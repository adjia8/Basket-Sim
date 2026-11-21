// Personnalités des joueurs, façon Football Manager — règles pures, sans
// accès base de données.
//
// Cinq traits cachés sur 1-20 : professionnalisme, ambition, loyauté,
// tempérament (bas = sanguin, haut = imperturbable) et leadership. Ils ne
// viennent d'aucune source officielle (personne ne publie ces données) : ils
// sont tirés de façon déterministe à partir de l'identifiant du joueur, donc
// un même joueur a la même personnalité dans toutes les carrières, sans
// stockage ni migration. Le leadership grandit avec l'âge (vétérans).

export interface Personality {
  professionalism: number;
  ambition: number;
  loyalty: number;
  temperament: number;
  leadership: number;
}

export const PERSONALITY_TRAITS: (keyof Personality)[] = [
  "professionalism",
  "ambition",
  "loyalty",
  "temperament",
  "leadership",
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Courbe en cloche sur 1-20 (moyenne 10,5, écart-type 4,5) : environ un
// joueur sur dix est très marqué dans un sens ou dans l'autre.
function trait(playerId: string, name: string): number {
  const u1 = (hash(`${playerId}:${name}:a`) + 1) / 4294967297;
  const u2 = hash(`${playerId}:${name}:b`) / 4294967296;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.min(20, Math.round(10.5 + 4.5 * z)));
}

export function personalityFor(playerId: string, age: number): Personality {
  const ageBonus = Math.max(0, Math.min(3, Math.round((age - 27) * 0.5)));
  return {
    professionalism: trait(playerId, "pro"),
    ambition: trait(playerId, "amb"),
    loyalty: trait(playerId, "loy"),
    temperament: trait(playerId, "tmp"),
    leadership: Math.min(20, trait(playerId, "lead") + ageBonus),
  };
}

// Étiquette lisible (clé i18n `personality.label.<valeur>`), dans l'ordre de
// priorité des profils les plus marquants.
export type PersonalityLabel =
  | "model_pro"
  | "born_leader"
  | "hothead"
  | "careerist"
  | "loyal"
  | "professional"
  | "fiery"
  | "unflappable"
  | "laid_back"
  | "unambitious"
  | "balanced";

export function personalityLabel(p: Personality): PersonalityLabel {
  if (p.professionalism >= 16 && p.ambition >= 14) return "model_pro";
  if (p.leadership >= 17) return "born_leader";
  if (p.temperament <= 5 && p.professionalism <= 8) return "hothead";
  if (p.ambition >= 15 && p.loyalty <= 7) return "careerist";
  if (p.loyalty >= 16) return "loyal";
  if (p.professionalism >= 15) return "professional";
  if (p.temperament <= 5) return "fiery";
  if (p.temperament >= 16) return "unflappable";
  if (p.professionalism <= 6) return "laid_back";
  if (p.ambition <= 5) return "unambitious";
  return "balanced";
}

// ---------------------------------------------------------------------------
// Effets

// Progression en saison : de ×0,7 (nonchalant) à ×1,3 (très professionnel).
export function growthMultiplier(p: Personality): number {
  return 0.7 + ((p.professionalism - 1) / 19) * 0.6;
}

// Mentor : vétéran (30 ans et plus) professionnel et respecté. Un effectif
// qui en compte un fait progresser ses jeunes (23 ans et moins) plus vite.
export function isMentor(p: Personality, age: number): boolean {
  return age >= 30 && p.professionalism >= 14 && p.leadership >= 12;
}
export const MENTOR_YOUTH_AGE = 23;
export const MENTOR_GROWTH_BONUS = 1.2;

// Moral : un sanguin vit les résultats et les critiques deux fois plus fort,
// un imperturbable encaisse moitié moins.
export function moraleVolatility(p: Personality): number {
  return p.temperament <= 6 ? 2 : p.temperament >= 15 ? 0.5 : 1;
}

// Applique la volatilité à une variation de moral (arrondi aléatoire pour
// qu'un « demi-point » compte une fois sur deux).
export function scaleMoraleDelta(delta: number, p: Personality, random: () => number = Math.random): number {
  if (delta === 0) return 0;
  const scaled = delta * moraleVolatility(p);
  const floor = Math.floor(Math.abs(scaled));
  const extra = random() < Math.abs(scaled) - floor ? 1 : 0;
  return Math.sign(delta) * (floor + extra);
}

// Fautes techniques (chance par vérification, voir foul-rules.ts) : de ×0,4
// (imperturbable) à ×3 (sanguin).
export function technicalFoulMultiplier(p: Personality): number {
  return p.temperament <= 5 ? 3 : p.temperament <= 9 ? 1.5 : p.temperament >= 16 ? 0.4 : 1;
}

// Négociation de contrat (voir contract-negotiation-rules.ts).
export interface NegotiationTraits {
  salaryMultiplier: number; // appliqué au plancher et à la demande
  patienceDelta: number;
  appealWeight: number; // poids de l'attrait de l'équipe (ambitieux : ×2)
}

export function negotiationTraits(p: Personality, ownPlayer: boolean): NegotiationTraits {
  // Loyauté : remise pour prolonger chez soi, surcoût pour un mercenaire.
  const loyalty = ownPlayer ? (p.loyalty >= 15 ? -0.08 : p.loyalty <= 6 ? 0.05 : 0) : 0;
  return {
    salaryMultiplier: 1 + loyalty,
    patienceDelta: (p.temperament <= 5 ? -1 : p.temperament >= 16 ? 1 : 0) + (ownPlayer && p.loyalty >= 15 ? 1 : 0),
    appealWeight: p.ambition >= 15 ? 2 : p.ambition <= 5 ? 0.5 : 1,
  };
}

// Demandes d'échange : un ambitieux veut partir d'une équipe qui perd (même
// s'il n'est pas une star) ; un fidèle le demande deux fois moins souvent.
export function ambitiousWantsOut(p: Personality, teamWinPct: number): boolean {
  return p.ambition >= 15 && teamWinPct < 0.4;
}
export function tradeRequestChanceMultiplier(p: Personality): number {
  return p.loyalty >= 15 ? 0.5 : p.loyalty <= 5 ? 1.5 : 1;
}

// ---------------------------------------------------------------------------
// Vestiaire

export interface LockerRoomMember {
  id: string;
  age: number;
  personality: Personality;
  overall?: number; // note actuelle
  renown?: number; // renommée 0-99
}

export interface LockerRoom {
  leaders: string[];
  mentors: string[];
  disruptive: string[];
  chemistryBonus: number; // ajouté à la cible de cohésion de l'équipe
}

export const MAX_LEADERS = 2;

// Stature d'un joueur dans le vestiaire : on ne suit pas un remplaçant, aussi
// charismatique soit-il. Peut prétendre au rôle de leader : une star (note
// 85+ ou renommée 80+), l'un des deux meilleurs joueurs de l'équipe, ou un
// vétéran (31 ans et plus) qui a encore du crédit (renommée 70+ ou note 78+),
// signe d'une carrière conséquente.
export function hasLeaderStature(m: LockerRoomMember, topTwoIds: Set<string>): boolean {
  const overall = m.overall ?? 0;
  const renown = m.renown ?? 0;
  const star = overall >= 85 || renown >= 80;
  const veteran = m.age >= 31 && (renown >= 70 || overall >= 78);
  return star || veteran || topTwoIds.has(m.id);
}

const isDisruptive = (p: Personality) => p.temperament <= 5 && p.professionalism <= 8;

// Leaders (au plus deux) : la star franchise d'office, puis, parmi les
// joueurs qui ont la stature, ceux qui ont aussi le tempérament (leadership
// 10+, pas une tête brûlée), les meilleurs d'abord (stature puis leadership). Les « têtes brûlées » (sanguin et
// peu professionnel) font baisser la cohésion ; un vrai meneur d'hommes
// (leadership 16+) la tire plus fort qu'un leader par le statut.
export function lockerRoom(members: LockerRoomMember[]): LockerRoom {
  const byOverall = [...members].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const topTwo = new Set(byOverall.slice(0, 2).filter((m) => m.overall !== undefined).map((m) => m.id));
  const score = (m: LockerRoomMember) => (m.overall ?? 0) + (m.renown ?? 0) * 0.5 + m.personality.leadership * 1.5;
  // La star franchise (meilleur joueur, note 85+ ou renommée 80+) est leader
  // de fait, quel que soit son caractère — sauf tête brûlée.
  const franchise = byOverall[0];
  const franchiseLeader =
    franchise && ((franchise.overall ?? 0) >= 85 || (franchise.renown ?? 0) >= 80) && !isDisruptive(franchise.personality)
      ? franchise
      : null;
  const others = members
    .filter((m) => m !== franchiseLeader && hasLeaderStature(m, topTwo) && m.personality.leadership >= 10 && !isDisruptive(m.personality))
    .sort((a, b) => score(b) - score(a));
  const leaderMembers = [...(franchiseLeader ? [franchiseLeader] : []), ...others].slice(0, MAX_LEADERS);
  const leaders = leaderMembers.map((m) => m.id);
  const mentors = members.filter((m) => isMentor(m.personality, m.age)).map((m) => m.id);
  const disruptive = members.filter((m) => isDisruptive(m.personality)).map((m) => m.id);
  const leaderBonus = leaderMembers.reduce((sum, m) => sum + (m.personality.leadership >= 16 ? 2 : 1), 0);
  const chemistryBonus = Math.min(4, leaderBonus) - Math.min(6, disruptive.length * 3);
  return { leaders, mentors, disruptive, chemistryBonus };
}

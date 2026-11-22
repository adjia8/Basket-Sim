// Carrière du GM — règles pures : évolution de ses compétences selon les
// résultats et le style de jeu, réputation (direction, joueurs, presse,
// fans), contrat et salaire, marché de l'emploi (licenciement, offres
// d'autres clubs), fortune personnelle et train de vie.

import type { GmSeasonOutcome } from "./gm-rules";

export const GM_ATTRIBUTES = ["offense", "defense", "physical", "tactical", "chemistry"] as const;
export type GmAttribute = (typeof GM_ATTRIBUTES)[number];
export type GmPoints = Record<GmAttribute, number>;
export const GM_ATTRIBUTE_MAX = 20;

// Note globale du GM (0-99) : 20 points au départ ≈ 52.
export function gmRating(p: GmPoints): number {
  const sum = GM_ATTRIBUTES.reduce((s, k) => s + p[k], 0);
  return Math.max(1, Math.min(99, Math.round(20 + sum * 1.6)));
}

export interface SeasonStyle {
  offenseRank: number; // classement aux points marqués (1 = meilleur)
  defenseRank: number; // classement aux points encaissés (1 = meilleur)
  teams: number;
  chemistry: number; // 0-99
  pace: string; // "slow" | "balanced" | "fast"
  offenseStyle: string; // "balanced" | "inside" | "perimeter" | "pick_and_roll" | "star"
  defenseStyle: string; // "man" | "zone" | "switch" | "press"
  outcome: GmSeasonOutcome | null; // null = saison en cours (projection)
}

// Évolution des compétences sur une saison : ce qui marche et ce qu'on
// pratique progresse, ce qu'on néglige s'érode un peu (au-delà de 12).
export function attributeEvolution(p: GmPoints, s: SeasonStyle): Record<GmAttribute, number> {
  const third = Math.max(1, Math.round(s.teams / 3));
  const rankDelta = (rank: number) => (rank <= 3 ? 2 : rank <= third ? 1 : rank > s.teams - third ? -1 : 0);
  const d: Record<GmAttribute, number> = { offense: 0, defense: 0, physical: 0, tactical: 0, chemistry: 0 };
  d.offense = rankDelta(s.offenseRank);
  d.defense = rankDelta(s.defenseRank);
  const physicalStyle = s.pace === "fast" || s.defenseStyle === "press";
  d.physical = physicalStyle ? 1 : p.physical > 12 ? -1 : 0;
  const system = s.offenseStyle !== "balanced" || s.defenseStyle === "zone" || s.defenseStyle === "switch";
  d.tactical = (system ? 1 : p.tactical > 12 ? -1 : 0) + (s.outcome === "exceeded" ? 1 : s.outcome === "fired" ? -1 : 0);
  d.chemistry = s.chemistry >= 70 ? 1 : s.chemistry <= 40 ? -1 : 0;
  for (const k of GM_ATTRIBUTES) {
    d[k] = Math.max(-p[k], Math.min(GM_ATTRIBUTE_MAX - p[k], d[k])) + 0; // + 0 : pas de « -0 »
  }
  return d;
}

// Image du GM au club, d'après quatre publics.
export interface StandingParts {
  board: number; // confiance de la direction
  players: number; // moral moyen du vestiaire
  press: number; // relation avec les médias
  fans: number; // opinion des fans
}
export function clubStanding(p: StandingParts): number {
  return Math.round(p.board * 0.3 + p.players * 0.25 + p.press * 0.2 + p.fans * 0.25);
}

const OUTCOME_REPUTATION: Record<GmSeasonOutcome, number> = { exceeded: 4, met: 1, warning: -3, fired: -7 };

// Réputation de carrière après une saison : image au club, bilan face aux
// objectifs, titre, et un soupçon de train de vie.
export function reputationAfterSeason(p: {
  reputation: number;
  standing: number;
  outcome: GmSeasonOutcome;
  champion: boolean;
  prestige: number;
}): number {
  const delta =
    Math.round((p.standing - 50) / 10) + OUTCOME_REPUTATION[p.outcome] + (p.champion ? 6 : 0) + Math.min(2, Math.floor(p.prestige / 20));
  return Math.max(1, Math.min(99, p.reputation + delta));
}

// Relation avec la presse après une conférence.
// Pas plus de ±2 par conférence (il y en a des dizaines par saison) : une
// bonne relation se construit sur la durée.
export function mediaRelationDelta(p: { publicOpinion: number; skipped: boolean; refereeCriticisms: number }): number {
  if (p.skipped) return -2;
  return Math.max(-2, Math.min(1, Math.round(p.publicOpinion / 4))) - p.refereeCriticisms;
}

// ---------------------------------------------------------------------------
// Contrat

// Salaire annuel d'un GM (ordre de grandeur NBA : 1,5 à 10 M$), selon sa
// réputation et le marché du club.
export function gmSalary(leagueId: string, marketAppeal: number, reputation: number): number {
  const nba = 1_500_000 + (Math.max(0, Math.min(99, reputation)) / 99) * 6_000_000 + (Math.max(0, Math.min(99, marketAppeal)) / 99) * 1_500_000;
  const raw = leagueId === "wnba" ? nba * 0.08 : nba;
  return Math.round(raw / 50_000) * 50_000;
}

export const HIRE_CONTRACT_YEARS = 3;
export const SEVERANCE_SHARE = 0.5;

export interface ContractTerms {
  salary: number;
  years: number;
}

// Prolongation proposée par la direction quand le contrat arrive à son
// terme et que le travail est bon.
export function extensionOffer(p: { salary: number; yearsLeft: number; outcome: GmSeasonOutcome; marketSalary: number }): ContractTerms | null {
  if (p.yearsLeft > 1 || (p.outcome !== "met" && p.outcome !== "exceeded")) return null;
  const raise = p.outcome === "exceeded" ? 1.15 : 1.05;
  return { salary: Math.round(Math.max(p.salary * raise, p.marketSalary) / 50_000) * 50_000, years: 3 };
}

export function severancePay(salary: number, yearsLeft: number): number {
  return Math.round(salary * Math.max(0, yearsLeft) * SEVERANCE_SHARE);
}

// ---------------------------------------------------------------------------
// Marché de l'emploi

// Chance de recevoir une offre d'un autre club en fin de saison.
export function poachChance(outcome: GmSeasonOutcome, reputation: number): number {
  if (outcome === "exceeded") return Math.min(0.75, 0.3 + reputation / 250);
  if (outcome === "met" && reputation >= 65) return 0.15;
  return 0;
}

// Clubs prêts à embaucher ce GM : les plus prestigieux (marché) exigent une
// réputation solide. Toujours au moins `min` clubs (les moins exigeants).
export function interestedTeams<T extends { id: string; marketAppeal: number }>(teams: T[], reputation: number, min = 4): T[] {
  const ok = teams.filter((t) => t.marketAppeal <= reputation + 25);
  if (ok.length >= min) return ok;
  return [...teams].sort((a, b) => a.marketAppeal - b.marketAppeal).slice(0, Math.min(min, teams.length));
}

// ---------------------------------------------------------------------------
// Train de vie

export type LifestyleCategory = "housing" | "car" | "wardrobe" | "extra";
export interface LifestyleItem {
  key: string;
  category: LifestyleCategory;
  price: number;
  prestige: number;
  fans?: number; // effet ponctuel sur l'opinion des fans à l'achat
}

export const LIFESTYLE_ITEMS: LifestyleItem[] = [
  { key: "apartment", category: "housing", price: 450_000, prestige: 2 },
  { key: "family_house", category: "housing", price: 1_200_000, prestige: 4 },
  { key: "loft", category: "housing", price: 2_500_000, prestige: 6 },
  { key: "villa", category: "housing", price: 6_000_000, prestige: 10 },
  { key: "penthouse", category: "housing", price: 12_000_000, prestige: 14 },
  { key: "estate", category: "housing", price: 25_000_000, prestige: 20 },
  { key: "city_car", category: "car", price: 25_000, prestige: 1 },
  { key: "sedan", category: "car", price: 60_000, prestige: 2 },
  { key: "electric_suv", category: "car", price: 110_000, prestige: 3 },
  { key: "sports_car", category: "car", price: 250_000, prestige: 6 },
  { key: "vintage_collection", category: "car", price: 600_000, prestige: 8 },
  { key: "supercar", category: "car", price: 1_500_000, prestige: 12 },
  { key: "classic_suits", category: "wardrobe", price: 20_000, prestige: 1 },
  { key: "tailored_suits", category: "wardrobe", price: 80_000, prestige: 4 },
  { key: "luxury_streetwear", category: "wardrobe", price: 150_000, prestige: 5 },
  { key: "haute_couture", category: "wardrobe", price: 400_000, prestige: 8 },
  { key: "luxury_watch", category: "extra", price: 90_000, prestige: 3 },
  { key: "art", category: "extra", price: 500_000, prestige: 5 },
  { key: "foundation", category: "extra", price: 2_000_000, prestige: 10, fans: 4 },
  { key: "yacht", category: "extra", price: 8_000_000, prestige: 12 },
  { key: "jet_share", category: "extra", price: 15_000_000, prestige: 15 },
];

export const lifestyleItem = (key: string) => LIFESTYLE_ITEMS.find((i) => i.key === key);
export const RESALE_SHARE = 0.6;
export const MAX_CARS = 4;

export function parseLifestyle(json: string | null | undefined): string[] {
  try {
    const v = json ? JSON.parse(json) : [];
    return Array.isArray(v) ? v.filter((k) => typeof k === "string" && lifestyleItem(k)) : [];
  } catch {
    return [];
  }
}

export function prestigeOf(owned: string[]): number {
  return owned.reduce((s, k) => s + (lifestyleItem(k)?.prestige ?? 0), 0);
}

export type LifestyleLevel = "modest" | "comfortable" | "star" | "tycoon";
export function lifestyleLevel(prestige: number): LifestyleLevel {
  return prestige >= 45 ? "tycoon" : prestige >= 25 ? "star" : prestige >= 10 ? "comfortable" : "modest";
}

export type PurchaseResult =
  | { ok: true; owned: string[]; cashDelta: number; fans: number }
  | { ok: false; error: "unknown" | "owned" | "funds" | "garage" };

// Achat : un seul logement et une seule garde-robe (l'ancien est revendu),
// garage limité.
export function purchase(owned: string[], key: string, cash: number): PurchaseResult {
  const item = lifestyleItem(key);
  if (!item) return { ok: false, error: "unknown" };
  if (owned.includes(key)) return { ok: false, error: "owned" };
  let next = [...owned];
  let refund = 0;
  if (item.category === "housing" || item.category === "wardrobe") {
    for (const k of owned) {
      const o = lifestyleItem(k)!;
      if (o.category === item.category) refund += Math.round(o.price * RESALE_SHARE);
    }
    next = next.filter((k) => lifestyleItem(k)!.category !== item.category);
  }
  if (item.category === "car" && next.filter((k) => lifestyleItem(k)!.category === "car").length >= MAX_CARS) {
    return { ok: false, error: "garage" };
  }
  if (cash + refund < item.price) return { ok: false, error: "funds" };
  next.push(key);
  return { ok: true, owned: next, cashDelta: refund - item.price, fans: item.fans ?? 0 };
}

export function sell(owned: string[], key: string): { owned: string[]; cashDelta: number } | null {
  const item = lifestyleItem(key);
  if (!item || !owned.includes(key)) return null;
  return { owned: owned.filter((k) => k !== key), cashDelta: Math.round(item.price * RESALE_SHARE) };
}

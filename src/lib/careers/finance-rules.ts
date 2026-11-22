// Règles pures de finances de franchise — aucun accès base de données ici,
// tout est piloté par src/lib/data-access/team-state.ts.

// Modèle de finances à l'échelle réelle (saison NBA 2025-26, sources :
// Sportico/Forbes — revenu moyen ≈ 456 M$ par équipe, de 339 M$ à 895 M$ ;
// droits TV nationaux ≈ 143 M$ par équipe, +7 %/an ; billetterie et loges
// ≈ 30 % ; sponsors ≈ 15 % ; restauration, boutique et autres ≈ 10 %).
// Les recettes et dépenses tombent match par match (voir finance.ts), la
// taxe de luxe et la part des propriétaires en fin de saison.

import { nightStarFactor } from "./attendance-rules";
import { ARENA_WORKS_FILL_PENALTY } from "./facility-projects-rules";

export const GAMES_PER_SEASON: Record<string, number> = { nba: 82, wnba: 44 };

interface LeagueEconomy {
  nationalTv2025: number; // par équipe et par saison (2025-26)
  localMedia: [number, number]; // selon le marché (min, max)
  sponsors: [number, number];
  capacity: number; // places en salle
  ticketPrice: [number, number]; // prix moyen du billet selon le marché
  concessionSpend: number; // dépense moyenne par spectateur (restauration)
  merchPerFan: number; // boutique, de base, par spectateur
  operationsPerHomeGame: number; // ouverture de la salle, personnel, sécurité
  overhead: number; // frais de structure par saison (voyages, marketing, administration)
  startingCash: [number, number]; // trésorerie de départ selon le marché
  healthyCash: number; // seuil « sain » (couleur de l'interface)
  upgrade: { training: [number, number]; arena: [number, number] }; // coût d'un palier selon le niveau
}

const ECONOMY: Record<string, LeagueEconomy> = {
  nba: {
    nationalTv2025: 143_000_000,
    localMedia: [15_000_000, 60_000_000],
    sponsors: [30_000_000, 110_000_000],
    capacity: 18_500,
    ticketPrice: [75, 180],
    concessionSpend: 30,
    merchPerFan: 8,
    operationsPerHomeGame: 600_000,
    overhead: 75_000_000,
    startingCash: [40_000_000, 120_000_000],
    healthyCash: 50_000_000,
    upgrade: { training: [10_000_000, 35_000_000], arena: [15_000_000, 50_000_000] },
  },
  // WNBA (en pause) : ordres de grandeur réduits.
  wnba: {
    nationalTv2025: 15_000_000,
    localMedia: [1_000_000, 5_000_000],
    sponsors: [2_000_000, 10_000_000],
    capacity: 9_000,
    ticketPrice: [30, 70],
    concessionSpend: 18,
    merchPerFan: 5,
    operationsPerHomeGame: 150_000,
    overhead: 8_000_000,
    startingCash: [5_000_000, 15_000_000],
    healthyCash: 6_000_000,
    upgrade: { training: [1_500_000, 5_000_000], arena: [2_000_000, 7_000_000] },
  },
};

const eco = (leagueId: string) => ECONOMY[leagueId] ?? ECONOMY.nba;
const lerp = ([a, b]: [number, number], t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
const market01 = (marketAppeal: number) => Math.max(0, Math.min(99, marketAppeal)) / 99;

export function initialFinances(leagueId: string, marketAppeal: number): number {
  return Math.round(lerp(eco(leagueId).startingCash, market01(marketAppeal)));
}

// Seuil de trésorerie « saine » — uniquement pour la couleur de l'interface.
export function healthyFinancesThreshold(leagueId: string): number {
  return eco(leagueId).healthyCash;
}

// Droits TV nationaux de la saison (+7 % par an depuis 2025-26).
export function nationalTvForSeason(leagueId: string, season: string): number {
  const years = Math.max(0, Number(season.slice(0, 4)) - 2025);
  return Math.round(eco(leagueId).nationalTv2025 * Math.pow(1.07, years));
}

// Prix des billets et de la restauration : pourcentage du prix « marché »
// (70 % à 150 %), fixé par le GM.
export const PRICE_LEVELS = [70, 80, 90, 100, 110, 120, 130, 140, 150];
export const DEFAULT_PRICE_LEVEL = 100;
export function clampPriceLevel(level: number): number {
  return PRICE_LEVELS.includes(level) ? level : DEFAULT_PRICE_LEVEL;
}

// Demande selon le prix : chaque 10 % au-dessus du prix marché fait perdre
// environ 7 % de spectateurs (et inversement, dans la limite de la salle).
export function priceDemand(level: number): number {
  return Math.max(0.4, 1 - 0.7 * (level / 100 - 1));
}

export interface HomeGameRevenue {
  fillRate: number; // 0-1
  attendees: number;
  tickets: number;
  premium: number; // loges et places premium
  concessions: number;
  merchandise: number;
}

// Recettes d'un match à domicile.
export function homeGameRevenue(p: {
  leagueId: string;
  attendance: number; // indice d'affluence 0-99 (voir attendance-rules.ts)
  marketAppeal: number;
  ticketLevel: number;
  concessionLevel: number;
  arenaLevel: number; // confort de la salle 0-99
  starRenown: number; // renommée de la plus grande star présente ce soir
  // Pouvoir d'attraction des stars ce soir (voir starPower, attendance-rules.ts).
  stars?: { homeAvailable: number; homeMissing: number; awayAvailable: number };
  playoff?: boolean;
  // Projets d'infrastructure livrés (voir facility-projects-rules.ts) ;
  // `works` : travaux en cours dans la salle (places condamnées).
  boost?: { fill: number; premium: number; concessions: number; merch: number; works: boolean };
}): HomeGameRevenue {
  const e = eco(p.leagueId);
  const b = p.boost ?? { fill: 0, premium: 0, concessions: 0, merch: 0, works: false };
  const arena = (p.arenaLevel - 50) / 100; // -0,5 à +0,5
  const night = p.stars ? nightStarFactor(p.stars.homeAvailable, p.stars.homeMissing, p.stars.awayAvailable) : 1;
  const works = b.works ? 1 - ARENA_WORKS_FILL_PENALTY : 1;
  const fillRate = Math.max(0.3, Math.min(1, (p.attendance / 100) * priceDemand(p.ticketLevel) * (1 + arena * 0.2) * night * (1 + b.fill))) * works;
  const attendees = Math.round(e.capacity * fillRate);
  const price = lerp(e.ticketPrice, market01(p.marketAppeal)) * (p.ticketLevel / 100) * (p.playoff ? 1.6 : 1);
  const tickets = attendees * price;
  const premium = tickets * (0.4 + arena * 0.3) * (1 + b.premium);
  // Restauration : plus cher = plus par achat, mais moins d'acheteurs.
  const concessions = attendees * e.concessionSpend * (p.concessionLevel / 100) * priceDemand(p.concessionLevel) * (1 + arena * 0.3) * (1 + b.concessions);
  const merchandise = attendees * e.merchPerFan * (1 + Math.max(0, p.starRenown - 50) / 50) * (1 + b.merch);
  return {
    fillRate,
    attendees,
    tickets: Math.round(tickets),
    premium: Math.round(premium),
    concessions: Math.round(concessions),
    merchandise: Math.round(merchandise),
  };
}

export interface SeasonShares {
  nationalTv: number;
  localMedia: number;
  sponsors: number;
}

// Recettes de saison réparties sur chaque match (domicile ou extérieur).
export function perGameShares(p: {
  leagueId: string;
  season: string;
  marketAppeal: number;
  winPct: number;
  publicOpinion: number;
  sponsorBoost?: number; // projets d'infrastructure (écran géant, fan zone)
}): SeasonShares {
  const e = eco(p.leagueId);
  const games = GAMES_PER_SEASON[p.leagueId] ?? 82;
  const m = market01(p.marketAppeal);
  const form = 0.8 + 0.4 * Math.max(0, Math.min(1, p.winPct)); // 0,8 à 1,2
  const opinion = 0.9 + (Math.max(0, Math.min(99, p.publicOpinion)) / 99) * 0.2; // 0,9 à 1,1
  return {
    nationalTv: Math.round(nationalTvForSeason(p.leagueId, p.season) / games),
    localMedia: Math.round((lerp(e.localMedia, m) * form) / games),
    sponsors: Math.round((lerp(e.sponsors, m) * form * opinion * (1 + (p.sponsorBoost ?? 0))) / games),
  };
}

export interface GameExpenses {
  payroll: number;
  staff: number;
  operations: number;
  overhead: number;
}

export function perGameExpenses(p: { leagueId: string; payroll: number; staffCost: number; home: boolean }): GameExpenses {
  const e = eco(p.leagueId);
  const games = GAMES_PER_SEASON[p.leagueId] ?? 82;
  return {
    payroll: Math.round(p.payroll / games),
    staff: Math.round(p.staffCost / games),
    operations: p.home ? e.operationsPerHomeGame : 0,
    overhead: Math.round(e.overhead / games),
  };
}

// Taxe de luxe NBA (barème non récidiviste) : 1,50 $ par dollar sur les
// 5 premiers millions au-dessus de la ligne, puis 1,75 $, 2,50 $, 3,25 $, et
// +0,50 $ par tranche de 5 M$ supplémentaire.
export function luxuryTaxBill(payroll: number, taxLine: number): number {
  let over = Math.max(0, payroll - taxLine);
  let rate = 1.5;
  let bill = 0;
  let bracket = 0;
  while (over > 0) {
    const slice = Math.min(over, 5_000_000);
    bill += slice * rate;
    over -= slice;
    bracket++;
    rate = bracket === 1 ? 1.75 : bracket === 2 ? 2.5 : bracket === 3 ? 3.25 : rate + 0.5;
  }
  return Math.round(bill);
}

// Part du bénéfice de la saison prélevée par les propriétaires.
export const OWNER_PROFIT_SHARE = 0.5;

// Améliorations : +UPGRADE_INCREMENT points, plus cher à mesure qu'on
// approche du maximum. « training » = centre d'entraînement, « arena » = salle.
export const UPGRADE_INCREMENT = 5;
export function upgradeCost(currentLevel: number, leagueId: string, component: "training" | "arena" = "training"): number {
  return Math.round(lerp(eco(leagueId).upgrade[component], Math.max(0, Math.min(99, currentLevel)) / 99));
}

export const ANNUAL_DEGRADATION = 4; // points perdus chaque intersaison sans réinvestissement

export function clampFacilityLevel(value: number): number {
  return Math.max(10, Math.min(99, value));
}

// Petit hash déterministe (même principe que seededVariance dans
// player-helpers.ts) : fait varier la situation de départ d'une équipe à
// l'autre sans dépendre de Math.random() — deux appels avec le même seed
// (ex. teamId) donnent toujours la même valeur.
function seededVariance(seed: string, spread: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const normalized = ((hash % 1000) + 1000) % 1000; // 0..999
  return Math.round((normalized / 999) * spread * 2 - spread);
}

// Niveau de départ des infrastructures/personnel : comme les finances, lié à
// l'attractivité du marché (une grande franchise investit historiquement
// plus), avec une variation par équipe pour éviter que toutes les franchises
// démarrent avec une barre identique.
export function initialFacilityLevel(marketAppeal: number, seed: string): number {
  const base = 30 + (Math.max(0, Math.min(99, marketAppeal)) / 99) * 40; // 30-70
  return clampFacilityLevel(Math.round(base + seededVariance(`${seed}-facilities`, 15)));
}

export function initialTrainingStaffLevel(marketAppeal: number, seed: string): number {
  const base = 30 + (Math.max(0, Math.min(99, marketAppeal)) / 99) * 40; // 30-70
  return clampFacilityLevel(Math.round(base + seededVariance(`${seed}-training-staff`, 15)));
}

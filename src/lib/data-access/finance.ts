import "server-only";
import { starPower } from "@/lib/careers/attendance-rules";
import { prisma } from "@/lib/prisma";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { NBA_TAX_LINE } from "@/lib/careers/cap-rules";
import { chargeLoans, facilityBonuses, parsePlan } from "@/lib/careers/facility-projects-rules";
import {
  ANNUAL_DEGRADATION,
  OWNER_PROFIT_SHARE,
  clampFacilityLevel,
  GAMES_PER_SEASON,
  homeGameRevenue,
  luxuryTaxBill,
  perGameExpenses,
  perGameShares,
} from "@/lib/careers/finance-rules";
import type { Player } from "@/lib/types";

// Compte de résultat d'une saison (montants cumulés, en dollars).
export interface SeasonLedger {
  season: string;
  homeGames: number;
  attendees: number;
  revenue: {
    nationalTv: number;
    localMedia: number;
    sponsors: number;
    tickets: number;
    premium: number;
    concessions: number;
    merchandise: number;
  };
  expenses: {
    payroll: number;
    staff: number;
    operations: number;
    overhead: number;
    luxuryTax: number;
    upgrades: number;
    ownerShare: number;
  };
}

export interface FinanceLedger {
  current: SeasonLedger;
  previous: SeasonLedger | null;
}

export function emptySeasonLedger(season: string): SeasonLedger {
  return {
    season,
    homeGames: 0,
    attendees: 0,
    revenue: { nationalTv: 0, localMedia: 0, sponsors: 0, tickets: 0, premium: 0, concessions: 0, merchandise: 0 },
    expenses: { payroll: 0, staff: 0, operations: 0, overhead: 0, luxuryTax: 0, upgrades: 0, ownerShare: 0 },
  };
}

export function parseLedger(json: string | null | undefined, season: string): FinanceLedger {
  try {
    const l = json ? (JSON.parse(json) as FinanceLedger) : null;
    if (l?.current?.season === season) return l;
    if (l?.current) return { current: emptySeasonLedger(season), previous: l.current };
  } catch {
    // compte illisible : on repart de zéro
  }
  return { current: emptySeasonLedger(season), previous: null };
}

export const totalRevenue = (s: SeasonLedger) => Object.values(s.revenue).reduce((a, b) => a + b, 0);
export const totalExpenses = (s: SeasonLedger) => Object.values(s.expenses).reduce((a, b) => a + b, 0);

const baseSeason = (label: string) => label.slice(0, 9);

// Recettes et dépenses d'un match pour une équipe (domicile ou extérieur).
// Saison régulière : parts de saison (TV, médias, sponsors) et dépenses
// courantes (salaires, staff, structure) ; matchs à domicile : billetterie,
// loges, restauration, boutique (prix des billets ×1,6 en playoffs). La
// pré-saison ne compte pas.
export async function computeGameFinances(p: {
  careerId: string;
  teamId: string;
  leagueId: string;
  gameSeason: string; // libellé du match ("2026-2027", "...-playoffs", "...-cup")
  home: boolean;
  marketAppeal: number;
  winPct: number;
  state: {
    finances: number;
    attendance: number;
    publicOpinion: number;
    ticketPriceLevel: number;
    concessionPriceLevel: number;
    arenaLevel: number;
    financeLedgerJson: string | null;
    facilityProjectsJson?: string | null;
  };
  roster: Player[];
  // Joueurs réellement disponibles ce soir (ni blessés, ni au repos), des
  // deux côtés : les stars présentes ou absentes pèsent sur le remplissage.
  available: Player[];
  opponentAvailable: Player[];
}): Promise<{ finances: number; financeLedgerJson: string } | null> {
  if (p.gameSeason.endsWith("-preseason")) return null;
  const season = baseSeason(p.gameSeason);
  const regular = /^\d{4}-\d{4}$/.test(p.gameSeason);
  const ledger = parseLedger(p.state.financeLedgerJson, season);
  const cur = ledger.current;
  let delta = 0;
  // Projets d'infrastructure livrés : recettes en plus, entretien.
  const fx = facilityBonuses(parsePlan(p.state.facilityProjectsJson), p.leagueId);

  if (regular) {
    const [payroll, staff] = await Promise.all([
      getPayrollForTeam(p.careerId, p.teamId),
      prisma.staffMember.aggregate({ where: { careerId: p.careerId, teamId: p.teamId }, _sum: { salary: true } }),
    ]);
    const shares = perGameShares({
      leagueId: p.leagueId,
      season,
      marketAppeal: p.marketAppeal,
      winPct: p.winPct,
      publicOpinion: p.state.publicOpinion,
      sponsorBoost: fx.sponsors,
    });
    const costs = perGameExpenses({ leagueId: p.leagueId, payroll, staffCost: staff._sum.salary ?? 0, home: p.home });
    costs.operations += Math.round(fx.upkeep / (GAMES_PER_SEASON[p.leagueId] ?? 82));
    cur.revenue.nationalTv += shares.nationalTv;
    cur.revenue.localMedia += shares.localMedia;
    cur.revenue.sponsors += shares.sponsors;
    cur.expenses.payroll += costs.payroll;
    cur.expenses.staff += costs.staff;
    cur.expenses.operations += costs.operations;
    cur.expenses.overhead += costs.overhead;
    delta += shares.nationalTv + shares.localMedia + shares.sponsors - costs.payroll - costs.staff - costs.operations - costs.overhead;
  }
  if (p.home) {
    const gate = homeGameRevenue({
      leagueId: p.leagueId,
      attendance: p.state.attendance,
      marketAppeal: p.marketAppeal,
      ticketLevel: p.state.ticketPriceLevel,
      concessionLevel: p.state.concessionPriceLevel,
      arenaLevel: p.state.arenaLevel,
      starRenown: Math.max(0, ...p.available.map((r) => r.renown)),
      stars: (() => {
        const full = starPower(p.roster.map((r) => r.renown));
        const homeAvailable = starPower(p.available.map((r) => r.renown));
        return {
          homeAvailable,
          homeMissing: Math.max(0, full - homeAvailable),
          awayAvailable: starPower(p.opponentAvailable.map((r) => r.renown)),
        };
      })(),
      playoff: p.gameSeason.endsWith("-playoffs"),
      boost: { fill: fx.fill, premium: fx.premium, concessions: fx.concessions, merch: fx.merch, works: fx.arenaWorks },
    });
    cur.homeGames += 1;
    cur.attendees += gate.attendees;
    cur.revenue.tickets += gate.tickets;
    cur.revenue.premium += gate.premium;
    cur.revenue.concessions += gate.concessions;
    cur.revenue.merchandise += gate.merchandise;
    delta += gate.tickets + gate.premium + gate.concessions + gate.merchandise;
    // Matchs à domicile hors saison régulière : ouverture de la salle aussi.
    if (!regular) {
      const ops = perGameExpenses({ leagueId: p.leagueId, payroll: 0, staffCost: 0, home: true }).operations;
      cur.expenses.operations += ops;
      delta -= ops;
    }
  }
  return { finances: p.state.finances + delta, financeLedgerJson: JSON.stringify(ledger) };
}

// Intersaison (avant le passage à la saison suivante) : taxe de luxe au vrai
// barème, part des propriétaires sur le bénéfice de la saison, usure des
// installations ; le compte de la saison devient « saison précédente ».
export async function closeSeasonFinances(careerId: string, teamId: string, leagueId: string, season: string): Promise<void> {
  const [state, payroll] = await Promise.all([
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
    getPayrollForTeam(careerId, teamId),
  ]);
  if (!state) return;
  const ledger = parseLedger(state.financeLedgerJson, season);
  const cur = ledger.current;
  const tax = leagueId === "nba" ? luxuryTaxBill(payroll, NBA_TAX_LINE) : 0;
  cur.expenses.luxuryTax += tax;
  const profit = totalRevenue(cur) - totalExpenses(cur);
  const ownerShare = profit > 0 ? Math.round(profit * OWNER_PROFIT_SHARE) : 0;
  cur.expenses.ownerShare += ownerShare;
  // Échéances des emprunts d'infrastructure.
  const loans = chargeLoans(state.facilityProjectsJson);
  cur.expenses.upgrades += loans.paid;
  await prisma.teamState.update({
    where: { id: state.id },
    data: {
      finances: state.finances - tax - ownerShare - loans.paid,
      facilityProjectsJson: loans.json,
      facilitiesLevel: clampFacilityLevel(state.facilitiesLevel - ANNUAL_DEGRADATION),
      arenaLevel: clampFacilityLevel(state.arenaLevel - ANNUAL_DEGRADATION),
      financeLedgerJson: JSON.stringify({ current: emptySeasonLedger(`${Number(season.slice(0, 4)) + 1}-${Number(season.slice(5, 9)) + 1}`), previous: cur }),
    },
  });
}

// Dépense d'investissement imputée au compte de la saison.
export function addUpgradeToLedger(json: string | null, season: string, cost: number): string {
  const ledger = parseLedger(json, season);
  ledger.current.expenses.upgrades += cost;
  return JSON.stringify(ledger);
}

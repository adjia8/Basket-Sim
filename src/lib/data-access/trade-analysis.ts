import "server-only";
import { prisma } from "@/lib/prisma";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getStandings } from "@/lib/data-access/standings";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { checkTradeSide, NBA_TAX_LINE, type CapVerdict } from "@/lib/careers/cap-rules";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { ALT_CONTRACT_SLOTS_PER_TEAM } from "@/lib/careers/contract-type-rules";
import { winPctForStandings } from "@/lib/careers/player-demands";
import {
  capSalary,
  evaluateTradeForAi,
  rosterMoveAllowed,
  smallestSufficientAddition,
  teamOutlook,
  tradeInterest,
  type AiTradeDecision,
  type TeamOutlook,
  type TradeAsset,
  type TradeCandidate,
  type TradeInterest,
} from "@/lib/careers/trade-rules";

// Analyse d'un échange (centre des transferts) : utilisée à la fois pour
// l'aperçu en direct pendant le montage et pour la proposition elle-même —
// mêmes règles, mêmes chiffres. Aucune écriture ici.

export interface TradeSelection {
  opponentTeamId: string;
  myPlayerIds: string[];
  theirPlayerIds: string[];
  myPickIds: string[];
  theirPickIds: string[];
}

export interface TradeSide {
  salaryOut: number;
  salaryIn: number;
  payrollBefore: number;
  payrollAfter: number;
  rosterBefore: number; // contrats standard
  rosterAfter: number;
}

export interface TradeSuggestion {
  kind: "pick" | "player";
  id: string;
}

export type TradeAnalysis =
  | { valid: false; error: "invalidOpponent" | "invalidSelection" }
  | {
      valid: true;
      complete: boolean; // au moins un élément de chaque côté
      me: TradeSide;
      them: TradeSide;
      salaryCap: number;
      taxLine: number;
      rosterOk: boolean;
      rosterMin: number;
      rosterMax: number;
      cap: CapVerdict; // premier côté en défaut, sinon ok
      opponentHuman: boolean;
      ai: {
        outlook: TeamOutlook;
        decision: AiTradeDecision;
        interest: TradeInterest;
        suggestion: TradeSuggestion | null;
      } | null;
    };

export async function analyzeTrade(
  careerId: string,
  myTeamId: string,
  leagueId: string,
  season: string,
  sel: TradeSelection
): Promise<TradeAnalysis> {
  const opponent = await prisma.team.findUnique({ where: { id: sel.opponentTeamId } });
  if (!opponent || opponent.leagueId !== leagueId || opponent.id === myTeamId) return { valid: false, error: "invalidOpponent" };

  const [myContractsAll, theirContractsAll, myPicksAll, theirPicks, league, myPayroll, theirPayroll, opponentManager] =
    await Promise.all([
      prisma.contract.findMany({ where: { careerId, teamId: myTeamId }, include: { player: true } }),
      prisma.contract.findMany({ where: { careerId, teamId: sel.opponentTeamId }, include: { player: true } }),
      prisma.draftPick.findMany({ where: { careerId, teamId: myTeamId, status: "pending" } }),
      prisma.draftPick.findMany({ where: { careerId, teamId: sel.opponentTeamId, status: "pending", id: { in: sel.theirPickIds } } }),
      getLeagueById(leagueId),
      getPayrollForTeam(careerId, myTeamId),
      getPayrollForTeam(careerId, sel.opponentTeamId),
      getMembershipForTeam(careerId, sel.opponentTeamId),
    ]);

  const myContracts = myContractsAll.filter((c) => sel.myPlayerIds.includes(c.playerId));
  const theirContracts = theirContractsAll.filter((c) => sel.theirPlayerIds.includes(c.playerId));
  const myPicks = myPicksAll.filter((p) => sel.myPickIds.includes(p.id));
  if (
    myContracts.length !== sel.myPlayerIds.length ||
    theirContracts.length !== sel.theirPlayerIds.length ||
    myPicks.length !== sel.myPickIds.length ||
    theirPicks.length !== sel.theirPickIds.length
  ) {
    return { valid: false, error: "invalidSelection" };
  }

  const isStd = (c: { contractType: string }) => c.contractType === "standard";
  const rosterMin = MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba;
  const rosterMax = MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba;
  const altSlots = ALT_CONTRACT_SLOTS_PER_TEAM[leagueId] ?? 0;
  const rosterOkFor = (out: typeof myContracts, inn: typeof myContracts, before: typeof myContractsAll) =>
    rosterMoveAllowed(
      {
        standardBefore: before.filter(isStd).length,
        altBefore: before.length - before.filter(isStd).length,
        standardOut: out.filter(isStd).length,
        altOut: out.length - out.filter(isStd).length,
        standardIn: inn.filter(isStd).length,
        altIn: inn.length - inn.filter(isStd).length,
      },
      rosterMin,
      rosterMax,
      altSlots
    );
  const rosterOk = rosterOkFor(myContracts, theirContracts, myContractsAll) && rosterOkFor(theirContracts, myContracts, theirContractsAll);

  const salaryCap = league?.salaryCap ?? Infinity;
  const taxLine = leagueId === "nba" ? NBA_TAX_LINE : Infinity;
  const capFor = (out: typeof myContracts, inn: typeof myContracts) => {
    const mine = checkTradeSide(leagueId, salaryCap, myPayroll, capSalary(out), capSalary(inn));
    const theirs = checkTradeSide(leagueId, salaryCap, theirPayroll, capSalary(inn), capSalary(out));
    return !mine.ok ? mine : theirs;
  };
  const cap = capFor(myContracts, theirContracts);

  const side = (out: typeof myContracts, inn: typeof myContracts, payroll: number, all: typeof myContractsAll): TradeSide => ({
    salaryOut: capSalary(out),
    salaryIn: capSalary(inn),
    payrollBefore: payroll,
    payrollAfter: payroll - capSalary(out) + capSalary(inn),
    rosterBefore: all.filter(isStd).length,
    rosterAfter: all.filter(isStd).length - out.filter(isStd).length + inn.filter(isStd).length,
  });

  const complete = sel.myPlayerIds.length + sel.myPickIds.length > 0 && sel.theirPlayerIds.length + sel.theirPickIds.length > 0;
  let ai: Extract<TradeAnalysis, { valid: true }>["ai"] = null;
  if (!opponentManager) {
    const allIds = [...myContractsAll, ...theirContracts].map((c) => c.playerId);
    const [teams, states, standings, expectations] = await Promise.all([
      getTeamsByLeague(leagueId),
      prisma.playerState.findMany({ where: { careerId, playerId: { in: allIds } }, select: { playerId: true, overallRating: true, age: true } }),
      getStandings(careerId, leagueId, season),
      getCareerExpectations(careerId, leagueId),
    ]);
    const stateById = new Map(states.map((s) => [s.playerId, s]));
    const asPlayer = (c: (typeof myContracts)[number]): TradeAsset => ({
      kind: "player",
      overall: stateById.get(c.playerId)?.overallRating ?? c.player.overallRating,
      age: stateById.get(c.playerId)?.age ?? c.player.age,
      salary: c.salary,
      standard: isStd(c),
    });
    const asPick = (p: { round: number; pickNumber: number | null }): TradeAsset => ({ kind: "pick", round: p.round, pickNumber: p.pickNumber });
    const row = standings.find((r) => r.teamId === sel.opponentTeamId);
    const outlook = teamOutlook({
      winPct: winPctForStandings(row?.wins ?? 0, row?.losses ?? 0),
      gamesPlayed: (row?.wins ?? 0) + (row?.losses ?? 0),
      expectation: expectations.get(sel.opponentTeamId) ?? null,
    });
    const received = [...myContracts.map(asPlayer), ...myPicks.map(asPick)];
    const given = [...theirContracts.map(asPlayer), ...theirPicks.map(asPick)];
    const base = { outlook, picksPerRound: teams.length, payrollBefore: theirPayroll, taxLine };
    const decision = evaluateTradeForAi({ ...base, received, given });

    // Suggestion : le plus petit ajout de mon côté qui ferait accepter
    // (choix de draft d'abord ; joueur seulement s'il respecte effectif et
    // règles salariales une fois ajouté).
    let suggestion: TradeSuggestion | null = null;
    if (complete && !decision.accept) {
      const candidates: TradeCandidate[] = [
        ...myPicksAll.filter((p) => !sel.myPickIds.includes(p.id)).map((p) => ({ id: `pick:${p.id}`, asset: asPick(p), allowed: true })),
        ...myContractsAll
          .filter((c) => !sel.myPlayerIds.includes(c.playerId))
          .map((c) => {
            const out = [...myContracts, c];
            return {
              id: `player:${c.playerId}`,
              asset: asPlayer(c),
              allowed: rosterOkFor(out, theirContracts, myContractsAll) && rosterOkFor(theirContracts, out, theirContractsAll) && capFor(out, theirContracts).ok,
            };
          }),
      ];
      const best = smallestSufficientAddition({ ...base, received, given, candidates });
      if (best) {
        const [kind, id] = best.id.split(":");
        suggestion = { kind: kind as "pick" | "player", id };
      }
    }
    ai = { outlook, decision, interest: tradeInterest(decision), suggestion };
  }

  return {
    valid: true,
    complete,
    me: side(myContracts, theirContracts, myPayroll, myContractsAll),
    them: side(theirContracts, myContracts, theirPayroll, theirContractsAll),
    salaryCap,
    taxLine,
    rosterOk,
    rosterMin,
    rosterMax,
    cap,
    opponentHuman: !!opponentManager,
    ai,
  };
}

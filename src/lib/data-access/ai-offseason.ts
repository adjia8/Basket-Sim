import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentDraftPick } from "@/lib/data-access/draft-picks";
import { performDraftPick } from "@/lib/data-access/draft-execution";
import { getFreeAgents, getPayrollForTeam } from "@/lib/data-access/contracts";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { checkSalaryMove } from "@/lib/careers/cap-rules";
import { minAcceptableSalary, teamMeetsPlayerDemands, winPctForStandings } from "@/lib/careers/player-demands";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { previousSeasonLabel } from "@/lib/careers/season-format";

// Gestion des équipes IA hors matchs — sans elle, l'IA ne draftait que si
// un humain cliquait pour elle à chaque choix, et ne signait jamais d'agent
// libre : ses effectifs fondaient saison après saison (fins de contrat,
// retraites). Appelé par « Continuer » (voir continueGame), donc toujours
// APRÈS que le manager a eu la main — comme dans Football Manager, le reste
// de la ligue bouge quand on avance.

const DRAFT_TIME_BUDGET_MS = 15_000;

export interface AiDraftResult {
  picked: number;
  // Équipe humaine dont c'est le tour (la draft attend son choix), sinon null.
  humanTeamOnTheClock: string | null;
  done: boolean;
}

// Fait drafter les équipes IA dans l'ordre, jusqu'au tour d'une équipe
// humaine ou la fin de la draft (choix : meilleur prospect disponible, comme
// le bouton « Drafter pour l'IA » de la page Draft).
export async function runAiDraft(careerId: string, season: string, leagueId: string): Promise<AiDraftResult> {
  const [league, teams, humans] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId }, select: { salaryCap: true } }),
    getTeamsByLeague(leagueId),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
  ]);
  const humanTeamIds = new Set(humans.map((m) => m.teamId));
  const salaryCap = league?.salaryCap ?? Infinity;

  const startedAt = Date.now();
  let picked = 0;
  for (;;) {
    const pick = await getCurrentDraftPick(careerId, season, salaryCap, teams.length, leagueId);
    if (!pick) return { picked, humanTeamOnTheClock: null, done: true };
    if (humanTeamIds.has(pick.teamId)) return { picked, humanTeamOnTheClock: pick.teamId, done: false };
    if (Date.now() - startedAt > DRAFT_TIME_BUDGET_MS) return { picked, humanTeamOnTheClock: null, done: false };

    // L'IA drafte sur la note ET le potentiel (voir potential-rules.ts) : un
    // jeune au plafond élevé peut passer devant un prospect plus prêt.
    const prospects = await prisma.prospect.findMany({ where: { careerId } });
    const draftValue = (p: (typeof prospects)[number]) => p.overallRating * 0.6 + (p.potential || p.overallRating) * 0.4;
    const best = prospects.sort((a, b) => draftValue(b) - draftValue(a))[0];
    if (!best) return { picked, humanTeamOnTheClock: null, done: true };
    if (await performDraftPick(pick, best, teams.length, leagueId)) picked++;
  }
}

// Effectif standard visé par l'IA : 14 en intersaison (une place laissée
// libre, comme beaucoup de vraies équipes), le plancher en cours de saison
// (remplacer un joueur parti, sans multiplier les signatures).
export function aiRosterTarget(leagueId: string, inSeason: boolean): number {
  const max = MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba;
  const min = MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba;
  return inSeason ? min : max - 1;
}

export interface AiSigning {
  teamId: string;
  playerId: string;
  salary: number;
  yearsRemaining: number;
}

// Agents libres de l'IA : chaque équipe IA sous sa cible signe, à tour de
// rôle (les plus en manque d'abord, au plus `maxRounds` joueurs chacune), le meilleur agent libre disponible qui
// accepte de venir (mêmes exigences que pour un manager humain : ambition,
// marché, infrastructures) et qu'elle peut payer selon les règles du
// plafond (en NBA, au-dessus du plafond : salaire minimum seulement).
export async function runAiFreeAgency(
  careerId: string,
  leagueId: string,
  season: string,
  target: number,
  // Tours de signature (une par équipe et par tour) : 1 par « Continuer »
  // en intersaison, pour que le marché se vide au fil des jours plutôt
  // qu'en un instant.
  maxRounds = 1
): Promise<AiSigning[]> {
  const [teams, humans, league, freeAgents] = await Promise.all([
    getTeamsByLeague(leagueId),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
    prisma.league.findUnique({ where: { id: leagueId }, select: { salaryCap: true } }),
    getFreeAgents(careerId, leagueId),
  ]);
  const humanTeamIds = new Set(humans.map((m) => m.teamId));
  const aiTeams = teams.filter((t) => !humanTeamIds.has(t.id));
  if (aiTeams.length === 0 || freeAgents.length === 0) return [];

  const standardCounts = await prisma.contract.groupBy({
    by: ["teamId"],
    where: { careerId, contractType: "standard", teamId: { in: aiTeams.map((t) => t.id) } },
    _count: true,
  });
  const countByTeam = new Map(standardCounts.map((c) => [c.teamId, c._count]));
  const needy = aiTeams.filter((t) => (countByTeam.get(t.id) ?? 0) < target);
  if (needy.length === 0) return [];

  // Attractivité sportive : bilan de la saison en cours, ou de la saison
  // écoulée tant qu'aucun match n'a été joué (intersaison).
  let standings = await getStandings(careerId, leagueId, season);
  if (standings.every((s) => s.wins + s.losses === 0)) {
    standings = await getStandings(careerId, leagueId, previousSeasonLabel(season));
  }
  const salaryCap = league?.salaryCap ?? Infinity;
  const context = await Promise.all(
    needy.map(async (team) => {
      const [payroll, state] = await Promise.all([
        getPayrollForTeam(careerId, team.id),
        getOrCreateTeamState(careerId, team.id, leagueId),
      ]);
      const row = standings.find((s) => s.teamId === team.id);
      return {
        team,
        payroll,
        count: countByTeam.get(team.id) ?? 0,
        winPct: winPctForStandings(row?.wins ?? 0, row?.losses ?? 0),
        facilitiesLevel: state.facilitiesLevel,
      };
    })
  );

  const pool = [...freeAgents].sort((a, b) => b.overallRating - a.overallRating);
  const signings: AiSigning[] = [];
  let progress = true;
  for (let round = 0; progress && round < maxRounds; round++) {
    progress = false;
    // Une signature par équipe et par tour, les plus en manque d'abord.
    for (const ctx of context.filter((c) => c.count < target).sort((a, b) => a.count - b.count)) {
      let offer: { index: number; salary: number; yearsRemaining: number } | null = null;
      for (let i = 0; i < pool.length && !offer; i++) {
        const player = pool[i];
        const accepts = teamMeetsPlayerDemands({
          renown: player.renown,
          teamWinPct: ctx.winPct,
          teamMarketAppeal: ctx.team.marketAppeal,
          teamFacilitiesLevel: ctx.facilitiesLevel,
        });
        const terms = accepts ? signingTerms(player, ctx.payroll, leagueId, salaryCap) : null;
        if (terms) offer = { index: i, ...terms };
      }
      if (!offer) continue;
      const [player] = pool.splice(offer.index, 1);
      signings.push({ teamId: ctx.team.id, playerId: player.id, salary: offer.salary, yearsRemaining: offer.yearsRemaining });
      ctx.payroll += offer.salary;
      ctx.count++;
      progress = true;
    }
  }
  if (signings.length === 0) return [];

  await prisma.contract.createMany({
    data: signings.map(({ teamId, playerId, salary, yearsRemaining }) => ({
      careerId,
      playerId,
      teamId,
      salary,
      yearsRemaining,
      guaranteed: true,
    })),
    // Un humain a pu signer le même joueur entre-temps (contrainte unique).
    skipDuplicates: true,
  });
  await prisma.playerTeamStint.createMany({
    data: signings.map(({ teamId, playerId }) => ({ careerId, playerId, teamId, season, reason: "signed" })),
  });
  return signings;
}

// Conditions auxquelles un agent libre signe avec cette équipe (tirées une
// seule fois : le salaire proposé comporte une part d'aléatoire), ou null
// si ce n'est pas possible — même logique que la signature par un manager
// humain (voir signFreeAgent) : exigence du joueur, puis exception minimum
// au-dessus du plafond en NBA.
function signingTerms(
  player: { overallRating: number; renown: number },
  payroll: number,
  leagueId: string,
  salaryCap: number
): { salary: number; yearsRemaining: number } | null {
  const terms = generateContractTerms(player.overallRating, leagueId);
  const floor = minAcceptableSalary(player.renown, player.overallRating, leagueId);
  let salary = Math.max(terms.salary, floor);
  const verdict = checkSalaryMove(leagueId, salaryCap, "sign", payroll + salary, salary);
  if (verdict.ok) return { salary, yearsRemaining: terms.yearsRemaining };
  if (verdict.reason !== "minimum_only" || floor > verdict.limit) return null;
  salary = Math.min(salary, verdict.limit);
  return checkSalaryMove(leagueId, salaryCap, "sign", payroll + salary, salary).ok
    ? { salary, yearsRemaining: terms.yearsRemaining }
    : null;
}

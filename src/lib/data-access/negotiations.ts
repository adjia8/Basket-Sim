import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { initialRenown } from "@/lib/careers/renown-rules";
import { minAcceptableSalary, teamMeetsPlayerDemands, winPctForStandings } from "@/lib/careers/player-demands";
import { SALARY_RANGES, baseSalaryFloor } from "@/lib/careers/salary-rules";
import {
  WALKOUT_COOLDOWN_DAYS,
  aiDeclinesTeamOption,
  playerOptsOut,
  playerStance,
  teamAppeal,
  type ContractOption,
  type Offer,
  type PlayerStance,
} from "@/lib/careers/contract-negotiation-rules";

export interface NegotiationView {
  kind: "extension" | "free_agent";
  stance: PlayerStance;
  patienceLeft: number;
  rounds: number;
  counter: Offer | null;
  // Le joueur a claqué la porte : plus de discussion avant ce nombre de jours.
  lockedDays: number | null;
  // Star non convaincue par le projet (bilan, marché, installations).
  refuses: boolean;
  rookieScale: boolean;
}

// Date de jeu « courante » : celle du dernier match joué de la saison.
async function currentGameDate(careerId: string, season: string): Promise<Date | null> {
  const last = await prisma.game.findFirst({
    where: { careerId, season, status: "final" },
    orderBy: { gameDate: "desc" },
    select: { gameDate: true },
  });
  return last?.gameDate ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Position du joueur face à CETTE équipe, et état de la négociation en cours
// (remise à zéro à chaque saison, ou quand la bouderie après une rupture est
// passée). Renvoie null si le joueur n'est pas négociable par cette équipe.
export async function getNegotiationView(params: {
  careerId: string;
  leagueId: string;
  season: string;
  teamId: string;
  playerId: string;
}): Promise<NegotiationView | null> {
  const { careerId, leagueId, season, teamId, playerId } = params;
  const [player, state, contract, standings, team, teamState, row, today] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({ where: { careerId_playerId: { careerId, playerId } } }),
    prisma.contract.findUnique({ where: { careerId_playerId: { careerId, playerId } } }),
    getStandings(careerId, leagueId, season),
    getTeamById(teamId),
    getOrCreateTeamState(careerId, teamId, leagueId),
    prisma.contractNegotiation.findUnique({ where: { careerId_playerId_teamId: { careerId, playerId, teamId } } }),
    currentGameDate(careerId, season),
  ]);
  if (!player || player.leagueId !== leagueId || !team || state?.retired) return null;
  if (contract && (contract.teamId !== teamId || contract.contractType !== "standard")) return null;
  const kind = contract ? "extension" : "free_agent";

  const renown = state?.renown ?? initialRenown(player.overallRating);
  const overallRating = state?.overallRating ?? player.overallRating;
  const myRow = standings.find((r) => r.teamId === teamId);
  const winPct = winPctForStandings(myRow?.wins ?? 0, myRow?.losses ?? 0);
  const rookieScale = !!contract?.isRookieScale;
  const stance = playerStance({
    renown,
    overallRating,
    age: state?.age ?? player.age,
    potential: state?.potential || overallRating,
    leagueId,
    morale: contract ? (state?.morale ?? 60) : null,
    teamAppeal: teamAppeal(winPct, team.marketAppeal, teamState.facilitiesLevel),
    rookieScale,
  });
  const refuses =
    !rookieScale &&
    !teamMeetsPlayerDemands({
      renown,
      teamWinPct: winPct,
      teamMarketAppeal: team.marketAppeal,
      teamFacilitiesLevel: teamState.facilitiesLevel,
    });

  let active = row && row.season === season ? row : null;
  let lockedDays: number | null = null;
  if (active?.status === "walked") {
    const elapsed =
      today && active.walkedGameDate ? Math.floor((today.getTime() - active.walkedGameDate.getTime()) / DAY_MS) : 0;
    const playedSince = today && (!active.walkedGameDate || today > active.walkedGameDate);
    if (active.walkedGameDate ? elapsed >= WALKOUT_COOLDOWN_DAYS : playedSince) active = null;
    else lockedDays = active.walkedGameDate ? WALKOUT_COOLDOWN_DAYS - elapsed : WALKOUT_COOLDOWN_DAYS;
  }

  return {
    kind,
    stance,
    patienceLeft: active?.status === "open" ? active.patienceLeft : stance.patience,
    rounds: active?.status === "open" ? active.rounds : 0,
    counter:
      active?.status === "open" && active.counterSalary != null && active.counterYears != null
        ? {
            salary: active.counterSalary,
            years: active.counterYears,
            option: (active.counterOption ?? "none") as ContractOption,
          }
        : null,
    lockedDays,
    refuses,
    rookieScale,
  };
}

export async function saveNegotiationRound(params: {
  careerId: string;
  playerId: string;
  teamId: string;
  season: string;
  patienceLeft: number;
  rounds: number;
  counter: Offer;
}): Promise<void> {
  const { careerId, playerId, teamId, season, patienceLeft, rounds, counter } = params;
  const data = {
    season,
    patienceLeft,
    rounds,
    counterSalary: counter.salary,
    counterYears: counter.years,
    counterOption: counter.option,
    status: "open",
    walkedGameDate: null,
  };
  await prisma.contractNegotiation.upsert({
    where: { careerId_playerId_teamId: { careerId, playerId, teamId } },
    create: { careerId, playerId, teamId, ...data },
    update: data,
  });
}

export async function recordWalkout(params: {
  careerId: string;
  playerId: string;
  teamId: string;
  season: string;
}): Promise<void> {
  const { careerId, playerId, teamId, season } = params;
  const walkedGameDate = await currentGameDate(careerId, season);
  const data = { season, patienceLeft: 0, status: "walked", walkedGameDate, counterSalary: null, counterYears: null, counterOption: null };
  await prisma.contractNegotiation.upsert({
    where: { careerId_playerId_teamId: { careerId, playerId, teamId } },
    create: { careerId, playerId, teamId, rounds: 0, ...data },
    update: data,
  });
}

export async function clearNegotiation(careerId: string, playerId: string, teamId: string): Promise<void> {
  await prisma.contractNegotiation.deleteMany({ where: { careerId, playerId, teamId } });
}

export interface OptionEvent {
  teamId: string;
  playerId: string;
  playerName: string;
  salary: number;
  kind: "playerOut" | "playerIn" | "teamOut";
}

// Intersaison, AVANT le décrément des contrats : les options portant sur la
// dernière année qui va commencer (yearsRemaining = 2) sont tranchées. Une
// option refusée libère le joueur (pas d'argent mort : l'année n'était pas
// garantie) ; une option exercée devient une dernière année ordinaire.
export async function resolveContractOptions(careerId: string, leagueId: string): Promise<OptionEvent[]> {
  const contracts = await prisma.contract.findMany({
    where: { careerId, yearsRemaining: 2, optionType: { not: null } },
    include: { player: true },
  });
  if (contracts.length === 0) return [];
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
  });
  const stateBy = new Map(states.map((s) => [s.playerId, s]));
  const range = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  const events: OptionEvent[] = [];
  for (const c of contracts) {
    const st = stateBy.get(c.playerId);
    const overall = st?.overallRating ?? c.player.overallRating;
    const renown = st?.renown ?? initialRenown(c.player.overallRating);
    const playerName = `${c.player.firstName} ${c.player.lastName}`;
    let release = false;
    if (c.optionType === "player") {
      release = playerOptsOut({
        marketSalary: minAcceptableSalary(renown, overall, leagueId),
        salary: c.salary,
        morale: st?.morale ?? 60,
      });
      events.push({ teamId: c.teamId, playerId: c.playerId, playerName, salary: c.salary, kind: release ? "playerOut" : "playerIn" });
    } else if (c.optionType === "team") {
      const human = await prisma.membership.findFirst({ where: { careerId, teamId: c.teamId }, select: { id: true } });
      release = human
        ? c.optionDeclined
        : aiDeclinesTeamOption({ marketSalary: baseSalaryFloor(overall, range), salary: c.salary });
      if (release) events.push({ teamId: c.teamId, playerId: c.playerId, playerName, salary: c.salary, kind: "teamOut" });
    }
    if (release) await prisma.contract.delete({ where: { id: c.id } });
    else await prisma.contract.update({ where: { id: c.id }, data: { optionType: null, optionDeclined: false } });
  }
  return events;
}

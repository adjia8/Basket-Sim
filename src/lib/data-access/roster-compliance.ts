import "server-only";
import { prisma } from "@/lib/prisma";
import type { Contract } from "@prisma/client";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, releaseOrder, rosterIssue, type RosterIssue } from "@/lib/careers/roster-rules";
import { runAiFreeAgency } from "@/lib/data-access/ai-offseason";

// Libère un joueur : contrat supprimé, argent mort s'il était garanti (un
// contrat de 2e tour non garanti n'en laisse aucun), demandes et promesses
// remises à zéro (il n'est plus le problème de ce GM).
export async function releaseContract(careerId: string, teamId: string, contract: Contract): Promise<void> {
  await prisma.$transaction([
    prisma.contract.delete({ where: { careerId_playerId: { careerId, playerId: contract.playerId } } }),
    ...(contract.guaranteed
      ? [
          prisma.deadCap.create({
            data: { careerId, teamId, playerId: contract.playerId, salary: contract.salary, yearsRemaining: contract.yearsRemaining },
          }),
        ]
      : []),
    prisma.playerState.updateMany({
      where: { careerId, playerId: contract.playerId },
      data: {
        wantsTrade: false,
        tradeRequestReasonsJson: null,
        tradeRequestSinceSeason: null,
        lastTradeRequestCheckDate: null,
        activePromiseType: null,
        activePromiseSeason: null,
        promiseOriginTeamId: null,
        pendingRequest: null,
        promisedStatus: null,
        promiseSince: null,
      },
    }),
  ]);
}

// Avant le premier match de la saison : les équipes IA trop fournies coupent
// leurs joueurs en trop, celles trop courtes signent des agents libres
// jusqu'au minimum. Retourne le nombre de coupes et de signatures.
export async function enforceAiRosterLimits(
  careerId: string,
  leagueId: string,
  season: string
): Promise<{ released: number; signed: number }> {
  const max = MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba;
  const min = MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba;
  const humans = new Set((await prisma.membership.findMany({ where: { careerId }, select: { teamId: true } })).map((m) => m.teamId));
  const contracts = await prisma.contract.findMany({
    where: { careerId, contractType: "standard", team: { leagueId } },
  });
  const byTeam = new Map<string, Contract[]>();
  for (const c of contracts) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), c]);
  const overall = new Map(
    (
      await prisma.playerState.findMany({
        where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } },
        select: { playerId: true, overallRating: true },
      })
    ).map((s) => [s.playerId, s.overallRating])
  );

  let released = 0;
  for (const [teamId, list] of byTeam) {
    if (humans.has(teamId) || list.length <= max) continue;
    const order = releaseOrder(list.map((c) => ({ ...c, overall: overall.get(c.playerId) ?? 0 })));
    for (const c of order.slice(0, list.length - max)) {
      await releaseContract(careerId, teamId, c);
      released++;
    }
  }

  let signed = 0;
  // Plusieurs tours : une équipe à 11 a besoin de deux signatures.
  for (let round = 0; round < min; round++) {
    const signings = await runAiFreeAgency(careerId, leagueId, season, min, 1);
    if (signings.length === 0) break;
    signed += signings.length;
  }
  return { released, signed };
}

export async function humanRosterIssue(
  careerId: string,
  teamId: string,
  leagueId: string
): Promise<{ issue: RosterIssue; size: number; min: number; max: number }> {
  const size = await prisma.contract.count({ where: { careerId, teamId, contractType: "standard" } });
  return {
    issue: rosterIssue(size, leagueId),
    size,
    min: MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba,
    max: MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba,
  };
}

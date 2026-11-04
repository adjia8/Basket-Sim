"use server";

import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getCurrentDraftPick } from "@/lib/data-access/draft-picks";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { performDraftPick } from "@/lib/data-access/draft-execution";

export async function draftProspect(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const prospectId = String(formData.get("prospectId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [league, teams, prospect] = await Promise.all([
    getLeagueById(membership.career.leagueId),
    getTeamsByLeague(membership.career.leagueId),
    prisma.prospect.findUnique({ where: { id: prospectId } }),
  ]);
  if (!league || !prospect || prospect.careerId !== membership.careerId) return;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.career.season,
    league.salaryCap,
    teams.length,
    membership.career.leagueId
  );
  if (!currentPick || currentPick.teamId !== membership.teamId) return; // pas mon tour

  await performDraftPick(currentPick, prospect, teams.length, membership.career.leagueId);
}

// Fait drafter une équipe gérée par l'IA — n'importe quel membre humain de la
// ligue peut déclencher ce pick (comme pour un match IA-vs-IA), sinon le
// draft resterait bloqué en l'absence de manager pour cette équipe.
export async function draftForAiTeam(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [league, teams] = await Promise.all([
    getLeagueById(membership.career.leagueId),
    getTeamsByLeague(membership.career.leagueId),
  ]);
  if (!league) return;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.career.season,
    league.salaryCap,
    teams.length,
    membership.career.leagueId
  );
  if (!currentPick) return;

  const manager = await getMembershipForTeam(membership.careerId, currentPick.teamId);
  if (manager) return; // équipe gérée par un autre humain, pas à toi de jouer pour elle

  const prospects = await prisma.prospect.findMany({ where: { careerId: membership.careerId } });
  const best = [...prospects].sort((a, b) => b.overallRating - a.overallRating)[0];
  if (!best) return;

  await performDraftPick(currentPick, best, teams.length, membership.career.leagueId);
}

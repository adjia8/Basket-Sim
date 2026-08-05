import { prisma } from "@/lib/prisma";

export interface TeamManager {
  userId: string;
  email: string;
}

// null = équipe gérée par l'IA (pas de Membership pour cette équipe dans la Career).
export async function getMembershipForTeam(
  careerId: string,
  teamId: string
): Promise<TeamManager | null> {
  const membership = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
    include: { user: true },
  });
  return membership ? { userId: membership.userId, email: membership.user.email } : null;
}

export async function getMembershipsForCareer(
  careerId: string
): Promise<Record<string, TeamManager>> {
  const memberships = await prisma.membership.findMany({
    where: { careerId },
    include: { user: true },
  });
  return Object.fromEntries(
    memberships.map((m) => [m.teamId, { userId: m.userId, email: m.user.email }])
  );
}

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decrypt, getSessionCookie } from "./session";
import { prisma } from "@/lib/prisma";

export const getSession = cache(async () => {
  return decrypt(await getSessionCookie());
});

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return { userId: session.userId };
});

export interface CurrentMembership {
  id: string;
  userId: string;
  teamId: string;
  careerId: string;
  leagueId: string;
  season: string;
  inviteCode: string;
}

function flattenMembership(membership: {
  id: string;
  userId: string;
  teamId: string;
  careerId: string;
  career: { leagueId: string; season: string; inviteCode: string };
}): CurrentMembership {
  return {
    id: membership.id,
    userId: membership.userId,
    teamId: membership.teamId,
    careerId: membership.careerId,
    leagueId: membership.career.leagueId,
    season: membership.career.season,
    inviteCode: membership.career.inviteCode,
  };
}

export const getCurrentMembership = cache(async (): Promise<CurrentMembership> => {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true, gmProfile: { select: { pendingReassignment: true } } },
  });
  if (!membership) {
    redirect("/onboarding");
  }
  // GM viré en fin de saison : doit choisir une nouvelle franchise avant de
  // pouvoir accéder au reste de l'app (voir src/app/onboarding/reassign/page.tsx,
  // qui ne passe volontairement pas par getCurrentMembership pour éviter une
  // boucle de redirection).
  if (membership.gmProfile?.pendingReassignment) {
    redirect("/onboarding/reassign");
  }
  return flattenMembership(membership);
});

export const getOptionalCurrentMembership = cache(
  async (): Promise<CurrentMembership | null> => {
    const session = await getSession();
    if (!session?.userId) return null;
    const membership = await prisma.membership.findUnique({
      where: { userId: session.userId },
      include: { career: true },
    });
    return membership ? flattenMembership(membership) : null;
  }
);

import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Un compte peut gérer plusieurs carrières (sauvegardes) : toutes les pages
// et actions travaillent sur la carrière ACTIVE, mémorisée sur le compte
// (User.activeMembershipId) et changée depuis la page « Mes carrières ».
// Sans choix valide (première connexion, carrière supprimée), c'est la plus
// récemment rejointe.

export const MAX_CAREERS_PER_USER = 5;

export const getActiveMembershipId = cache(async (userId: string): Promise<string | null> => {
  const [user, latest] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { activeMembershipId: true } }),
    prisma.membership.findFirst({ where: { userId }, orderBy: { joinedAt: "desc" }, select: { id: true } }),
  ]);
  if (user?.activeMembershipId) {
    const stillMine = await prisma.membership.count({ where: { id: user.activeMembershipId, userId } });
    if (stillMine > 0) return user.activeMembershipId;
  }
  return latest?.id ?? null;
});

// Filtre Prisma vers la carrière active (ne correspond à rien s'il n'y en a
// pas) : `prisma.membership.findFirst({ where: await activeMembershipWhere(userId) })`.
export async function activeMembershipWhere(userId: string): Promise<{ id: string; userId: string }> {
  return { id: (await getActiveMembershipId(userId)) ?? "__none__", userId };
}

export async function setActiveMembership(userId: string, membershipId: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { activeMembershipId: membershipId } });
}

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

export const getCurrentCareer = cache(async () => {
  const { userId } = await verifySession();
  const career = await prisma.career.findUnique({
    where: { userId },
    include: { league: true, team: true },
  });
  if (!career) {
    redirect("/onboarding");
  }
  return career;
});

export const getOptionalCurrentCareer = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;
  return prisma.career.findUnique({
    where: { userId: session.userId },
    include: { league: true, team: true },
  });
});

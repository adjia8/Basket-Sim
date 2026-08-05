"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateCareerSchedule } from "@/lib/careers/generate-schedule";
import { generateCareerContracts } from "@/lib/careers/generate-contracts";
import { generateCareerPlayerStates } from "@/lib/careers/generate-player-states";
import { generateInviteCode } from "@/lib/careers/invite-code";
import { toDomainLeague, toDomainPlayer } from "@/lib/data-access/mappers";

export interface CreateCareerState {
  error?: string;
}

export async function createCareer(
  _prevState: CreateCareerState | undefined,
  formData: FormData
): Promise<CreateCareerState> {
  const { userId } = await verifySession();
  const leagueId = String(formData.get("leagueId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");

  const [league, team, existing] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      include: { conferences: true },
    }),
    prisma.team.findFirst({ where: { id: teamId, leagueId } }),
    prisma.membership.findUnique({ where: { userId } }),
  ]);

  if (!league || !team) {
    return { error: "Ligue ou équipe invalide." };
  }
  if (existing) {
    redirect("/");
  }

  let career: { id: string };
  // Collision extrêmement improbable (32^6 combinaisons) — quelques tentatives suffisent.
  for (let attempt = 0; ; attempt++) {
    try {
      career = await prisma.career.create({
        data: {
          leagueId,
          season: league.season,
          inviteCode: generateInviteCode(),
          memberships: { create: { userId, teamId } },
        },
      });
      break;
    } catch (err) {
      if (attempt < 5 && err instanceof Error && "code" in err && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  // Les contrats (qui portent désormais l'affectation d'équipe pour cette
  // Career) doivent exister AVANT la génération du calendrier, qui a besoin
  // des rosters pour pré-simuler les matchs déjà joués.
  const leaguePlayers = await prisma.player.findMany({ where: { leagueId } });
  const domainPlayers = leaguePlayers.map(toDomainPlayer);
  await generateCareerContracts(career.id, leagueId, domainPlayers);
  await generateCareerPlayerStates(career.id, domainPlayers);
  await generateCareerSchedule(career.id, toDomainLeague(league), {
    seasonLabel: league.season,
    presimulatePast: true,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export interface JoinCareerState {
  error?: string;
}

export async function joinCareer(
  _prevState: JoinCareerState | undefined,
  formData: FormData
): Promise<JoinCareerState> {
  const { userId } = await verifySession();
  const inviteCode = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();
  const teamId = String(formData.get("teamId") ?? "");

  const [career, existing] = await Promise.all([
    prisma.career.findUnique({ where: { inviteCode } }),
    prisma.membership.findUnique({ where: { userId } }),
  ]);

  if (existing) {
    redirect("/");
  }
  if (!career) {
    return { error: "Code d'invitation invalide." };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, leagueId: career.leagueId },
  });
  if (!team) {
    return { error: "Équipe invalide pour cette ligue." };
  }

  try {
    await prisma.membership.create({
      data: { userId, careerId: career.id, teamId },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: "Cette équipe est déjà prise par un autre manager." };
    }
    throw err;
  }

  revalidatePath("/", "layout");
  redirect("/");
}

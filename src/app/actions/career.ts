"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateCareerSchedule } from "@/lib/careers/generate-schedule";
import { generateCareerContracts } from "@/lib/careers/generate-contracts";
import { generateCareerPlayerStates } from "@/lib/careers/generate-player-states";
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
    prisma.career.findUnique({ where: { userId } }),
  ]);

  if (!league || !team) {
    return { error: "Ligue ou équipe invalide." };
  }
  if (existing) {
    redirect("/");
  }

  const career = await prisma.career.create({
    data: { userId, leagueId, teamId, season: league.season },
  });

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

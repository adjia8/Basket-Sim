"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateCareerSchedule } from "@/lib/careers/generate-schedule";
import { generateCareerContracts } from "@/lib/careers/generate-contracts";
import { generateCareerPlayerStates } from "@/lib/careers/generate-player-states";
import { generateInviteCode } from "@/lib/careers/invite-code";
import {
  createUnresolvedPicksForSeason,
  FUTURE_PICK_WINDOW,
  futureSeasonsAfter,
} from "@/lib/careers/generate-draft-picks";
import { toDomainLeague, toDomainPlayer } from "@/lib/data-access/mappers";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { GM_POINT_POOL, expectationForRoster } from "@/lib/careers/gm-rules";

export interface CreateCareerState {
  error?: string;
}

const VALID_SEXES = new Set(["M", "F", "autre"]);

interface GmFormFields {
  firstName: string;
  lastName: string;
  age: number;
  sex: string;
  offensePoints: number;
  defensePoints: number;
  physicalPoints: number;
  tacticalPoints: number;
  chemistryPoints: number;
}

// Ne fait jamais confiance au client pour la répartition des points — revalide
// systématiquement que la somme égale exactement GM_POINT_POOL.
function parseGmFields(formData: FormData): GmFormFields | null {
  const firstName = String(formData.get("gmFirstName") ?? "").trim();
  const lastName = String(formData.get("gmLastName") ?? "").trim();
  const age = Number(formData.get("gmAge"));
  const sex = String(formData.get("gmSex") ?? "");
  const offensePoints = Number(formData.get("gmOffensePoints"));
  const defensePoints = Number(formData.get("gmDefensePoints"));
  const physicalPoints = Number(formData.get("gmPhysicalPoints"));
  const tacticalPoints = Number(formData.get("gmTacticalPoints"));
  const chemistryPoints = Number(formData.get("gmChemistryPoints"));

  if (!firstName || !lastName) return null;
  if (!Number.isInteger(age) || age < 25 || age > 80) return null;
  if (!VALID_SEXES.has(sex)) return null;
  const points = [offensePoints, defensePoints, physicalPoints, tacticalPoints, chemistryPoints];
  if (points.some((p) => !Number.isInteger(p) || p < 0)) return null;
  if (points.reduce((sum, p) => sum + p, 0) !== GM_POINT_POOL) return null;

  return { firstName, lastName, age, sex, offensePoints, defensePoints, physicalPoints, tacticalPoints, chemistryPoints };
}

export async function createCareer(
  _prevState: CreateCareerState | undefined,
  formData: FormData
): Promise<CreateCareerState> {
  const { userId } = await verifySession();
  const leagueId = String(formData.get("leagueId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const gm = parseGmFields(formData);
  if (!gm) {
    return { error: "Identité du GM ou répartition des points invalide." };
  }

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

  let career: { id: string; memberships: { id: string }[] };
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
        include: { memberships: true },
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

  const teamCatalogRoster = domainPlayers.filter((p) => p.teamId === teamId);
  const teamAverageOverall = teamCatalogRoster.length
    ? teamCatalogRoster.reduce((sum, p) => sum + p.overallRating, 0) / teamCatalogRoster.length
    : 50;
  await prisma.gmProfile.create({
    data: {
      membershipId: career.memberships[0].id,
      firstName: gm.firstName,
      lastName: gm.lastName,
      age: gm.age,
      sex: gm.sex,
      offensePoints: gm.offensePoints,
      defensePoints: gm.defensePoints,
      physicalPoints: gm.physicalPoints,
      tacticalPoints: gm.tacticalPoints,
      chemistryPoints: gm.chemistryPoints,
      hiredSeason: league.season,
      currentExpectationTier: expectationForRoster(teamAverageOverall, team.marketAppeal),
    },
  });

  await generateCareerContracts(career.id, leagueId, domainPlayers);
  await generateCareerPlayerStates(career.id, domainPlayers);
  await generateCareerSchedule(career.id, toDomainLeague(league), {
    seasonLabel: league.season,
    presimulatePast: true,
  });

  // Chaque équipe possède déjà ses picks des prochaines saisons, échangeables
  // avant même que ces saisons n'existent (comme en vraie NBA).
  const leagueTeams = await getTeamsByLeague(leagueId);
  const leagueTeamIds = leagueTeams.map((t) => t.id);
  for (const futureSeason of futureSeasonsAfter(league.season, FUTURE_PICK_WINDOW)) {
    await createUnresolvedPicksForSeason(career.id, futureSeason, leagueTeamIds);
  }

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
  const gm = parseGmFields(formData);
  if (!gm) {
    return { error: "Identité du GM ou répartition des points invalide." };
  }

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

  let membership: { id: string };
  try {
    membership = await prisma.membership.create({
      data: { userId, careerId: career.id, teamId },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return { error: "Cette équipe est déjà prise par un autre manager." };
    }
    throw err;
  }

  const roster = await prisma.contract.findMany({
    where: { careerId: career.id, teamId },
    include: { player: { select: { overallRating: true } } },
  });
  const teamAverageOverall = roster.length
    ? roster.reduce((sum, c) => sum + c.player.overallRating, 0) / roster.length
    : 50;
  await prisma.gmProfile.create({
    data: {
      membershipId: membership.id,
      firstName: gm.firstName,
      lastName: gm.lastName,
      age: gm.age,
      sex: gm.sex,
      offensePoints: gm.offensePoints,
      defensePoints: gm.defensePoints,
      physicalPoints: gm.physicalPoints,
      tacticalPoints: gm.tacticalPoints,
      chemistryPoints: gm.chemistryPoints,
      hiredSeason: career.season,
      currentExpectationTier: expectationForRoster(teamAverageOverall, team.marketAppeal),
    },
  });

  revalidatePath("/", "layout");
  redirect("/");
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { addDays, generateCareerPreseasonSchedule, generateCareerSchedule } from "@/lib/careers/generate-schedule";
import { generateCareerContracts } from "@/lib/careers/generate-contracts";
import { generateCareerPlayerStates } from "@/lib/careers/generate-player-states";
import { generateInviteCode } from "@/lib/careers/invite-code";
import { PRESEASON_SPAN_DAYS, preseasonSeasonLabel } from "@/lib/careers/schedule-rules";
import {
  createUnresolvedPicksForSeason,
  FUTURE_PICK_WINDOW,
  futureSeasonsAfter,
} from "@/lib/careers/generate-draft-picks";
import { toDomainLeague, toDomainPlayer } from "@/lib/data-access/mappers";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { GM_POINT_POOL, expectationForRoster } from "@/lib/careers/gm-rules";
import { INITIAL_FREE_AGENT_IDS } from "@/lib/mock-data/players-wnba";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";

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

  const leaguePlayers = await prisma.player.findMany({ where: { leagueId } });
  const domainPlayers = leaguePlayers.map(toDomainPlayer);

  // Catalogue plein (chaque joueuse WNBA correspond exactement à un effectif
  // d'équipe) : sans exception, le vivier d'agents libres serait vide dès la
  // création d'une carrière, jusqu'à ce qu'un contrat expire ou qu'une
  // équipe coupe une joueuse (donc au plus tôt à l'intersaison suivante).
  // INITIAL_FREE_AGENT_IDS liste les joueuses qui ne reçoivent pas de
  // contrat au départ (voir sa doc dans players-wnba.ts) — exclues aussi du
  // calcul de force d'effectif ci-dessous, cohérence oblige.
  const initiallyFreeAgentIds = new Set(leagueId === "wnba" ? INITIAL_FREE_AGENT_IDS : []);

  // Certaines franchises du catalogue (roster réel complet, camp
  // d'entraînement inclus) dépassent MAX_ROSTER_SIZE — sans ce filtrage,
  // l'équipe démarrerait la Career déjà hors plafond, ce qui bloque en
  // silence tout échange ou toute signature d'agent libre pour cette équipe
  // dès le premier jour (aucune transaction "neutre" en effectif ne peut
  // jamais faire redescendre un total déjà trop haut sous la barre). Les
  // joueuses en surnombre (les moins bien notées) rejoignent le vivier
  // d'agents libres plutôt que de recevoir un contrat.
  const maxRosterSize = MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba;
  const rosterByTeam = new Map<string, typeof domainPlayers>();
  for (const player of domainPlayers) {
    if (initiallyFreeAgentIds.has(player.id)) continue;
    const list = rosterByTeam.get(player.teamId) ?? [];
    list.push(player);
    rosterByTeam.set(player.teamId, list);
  }
  for (const roster of rosterByTeam.values()) {
    if (roster.length <= maxRosterSize) continue;
    const overflow = [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(maxRosterSize);
    for (const player of overflow) initiallyFreeAgentIds.add(player.id);
  }

  const playersUnderContract = domainPlayers.filter((p) => !initiallyFreeAgentIds.has(p.id));

  const teamCatalogRoster = playersUnderContract.filter((p) => p.teamId === teamId);
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

  // generateCareerPlayerStates reçoit TOUJOURS le catalogue complet (les
  // agents libres doivent aussi vieillir dans la Career) — seuls les
  // contrats sont filtrés (playersUnderContract, calculé plus haut).
  await generateCareerContracts(career.id, leagueId, playersUnderContract);
  await generateCareerPlayerStates(career.id, domainPlayers);

  // La partie démarre dans l'entre-saison, juste après le draft : quelques
  // matchs de pré-saison à jouer (voir generateCareerPreseasonSchedule),
  // puis la saison régulière ouvre strictement après — aucun match n'est
  // déjà joué au moment où le GM prend ses fonctions.
  const today = new Date();
  await generateCareerPreseasonSchedule(career.id, toDomainLeague(league), {
    seasonLabel: preseasonSeasonLabel(league.season),
    startDate: today,
  });
  await generateCareerSchedule(career.id, toDomainLeague(league), {
    seasonLabel: league.season,
    startDate: addDays(today, PRESEASON_SPAN_DAYS),
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

// Supprime l'implication de l'utilisateur dans sa carrière actuelle — ne
// supprime la Career elle-même (et tout son historique de matchs/contrats
// via cascade Prisma) que si plus personne n'y est rattaché : une Career
// peut être partagée entre plusieurs managers humains (rejoint par code
// d'invitation, voir JoinCareerForm), donc un simple "je pars" ne doit
// jamais effacer la partie des autres.
export async function deleteCareer(): Promise<void> {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) redirect("/onboarding");

  await prisma.membership.delete({ where: { userId } });

  const remaining = await prisma.membership.count({ where: { careerId: membership.careerId } });
  if (remaining === 0) {
    await prisma.career.delete({ where: { id: membership.careerId } });
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

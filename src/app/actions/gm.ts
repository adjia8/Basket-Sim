"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { gmSalary, HIRE_CONTRACT_YEARS, interestedTeams, parseLifestyle, purchase, sell } from "@/lib/careers/gm-career-rules";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatSalary } from "@/lib/utils";

async function switchTeam(
  membershipId: string,
  careerId: string,
  newTeamId: string,
  terms?: { salary: number; years: number }
): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: newTeamId } });
  if (!team) return;
  const expectations = await getCareerExpectations(careerId, team.leagueId);

  const career = await prisma.career.findUnique({ where: { id: careerId } });
  if (!career) return;
  const gm = await prisma.gmProfile.findUnique({ where: { membershipId }, select: { reputation: true } });
  // Nouveau contrat : conditions de l'offre, sinon le salaire du marché.
  const contract = terms ?? { salary: gmSalary(team.leagueId, team.marketAppeal, gm?.reputation ?? 45), years: HIRE_CONTRACT_YEARS };

  await prisma.$transaction([
    prisma.membership.update({ where: { id: membershipId }, data: { teamId: newTeamId } }),
    prisma.gmProfile.update({
      where: { membershipId },
      data: {
        pendingReassignment: false,
        pendingOfferTeamId: null,
        pendingOfferJson: null,
        pendingExtensionJson: null,
        contractSalary: contract.salary,
        contractYears: contract.years,
        // Nouvelle direction : confiance à reconstruire.
        frontOfficeApproval: 50,
        warningsAtCurrentTeam: 0,
        hiredSeason: career.season,
        currentExpectationTier: expectations.get(newTeamId) ?? "playoffs",
      },
    }),
  ]);
}

// Un GM viré (GmProfile.pendingReassignment) choisit une nouvelle franchise
// parmi les équipes actuellement gérées par l'IA de la même Career.
export async function reassignFranchise(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const teamId = String(formData.get("teamId") ?? "");

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { gmProfile: true },
  });
  if (!membership?.gmProfile?.pendingReassignment) return;

  const alreadyTaken = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId: membership.careerId, teamId } },
  });
  if (alreadyTaken) return;

  const career = await prisma.career.findUnique({ where: { id: membership.careerId } });
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId: career?.leagueId } });
  if (!career || !team) return;
  // Seuls les clubs intéressés par ce GM (selon sa réputation) l'embauchent.
  const teams = await prisma.team.findMany({ where: { leagueId: career.leagueId }, select: { id: true, marketAppeal: true } });
  if (!interestedTeams(teams, membership.gmProfile.reputation).some((t) => t.id === teamId)) return;

  await switchTeam(membership.id, membership.careerId, teamId);
  revalidatePath("/", "layout");
  redirect("/");
}

// Offre de dépeçage acceptée : même mécanique de changement d'équipe,
// déclenchée par l'offre enregistrée par advanceSeason (pas par le client).
export async function acceptPoachOffer(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { gmProfile: true },
  });
  const offerTeamId = membership?.gmProfile?.pendingOfferTeamId;
  if (!membership || !offerTeamId) return;

  const alreadyTaken = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId: membership.careerId, teamId: offerTeamId } },
  });
  if (alreadyTaken) return;

  const terms = (() => {
    try {
      return membership.gmProfile?.pendingOfferJson ? (JSON.parse(membership.gmProfile.pendingOfferJson) as { salary: number; years: number }) : undefined;
    } catch {
      return undefined;
    }
  })();
  await switchTeam(membership.id, membership.careerId, offerTeamId, terms);
  revalidatePath("/", "layout");
}

export async function declinePoachOffer(): Promise<void> {
  const { userId } = await verifySession();

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { gmProfile: true },
  });
  if (!membership?.gmProfile) return;

  await prisma.gmProfile.update({
    where: { membershipId: membership.id },
    data: { pendingOfferTeamId: null, pendingOfferJson: null },
  });
  revalidatePath("/gm");
}

// Prolongation proposée par la direction (voir extensionOffer).
export async function respondToExtension(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const accept = String(formData.get("decision") ?? "") === "accept";
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { gmProfile: true } });
  const gm = membership?.gmProfile;
  if (!gm?.pendingExtensionJson) return;
  const ext = JSON.parse(gm.pendingExtensionJson) as { salary: number; years: number };
  await prisma.gmProfile.update({
    where: { id: gm.id },
    data: accept
      ? { contractSalary: ext.salary, contractYears: ext.years, pendingExtensionJson: null, frontOfficeApproval: Math.min(99, gm.frontOfficeApproval + 3) }
      : { pendingExtensionJson: null, frontOfficeApproval: Math.max(0, gm.frontOfficeApproval - 3) },
  });
  revalidatePath("/gm");
}

export interface LifestyleFormState {
  error?: string;
  success?: string;
}

// Train de vie : acheter ou revendre (voir gm-career-rules.ts).
export async function lifestyleAction(_prev: LifestyleFormState | undefined, formData: FormData): Promise<LifestyleFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const key = String(formData.get("item") ?? "");
  const mode = String(formData.get("mode") ?? "buy");
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { gmProfile: true } });
  const gm = membership?.gmProfile;
  if (!membership || !gm) return { error: t("lifestyle.error.unknown") };
  const owned = parseLifestyle(gm.lifestyleJson);
  const name = t(`lifestyle.item.${key}` as DictionaryKey);
  if (mode === "sell") {
    const res = sell(owned, key);
    if (!res) return { error: t("lifestyle.error.unknown") };
    await prisma.gmProfile.update({ where: { id: gm.id }, data: { lifestyleJson: JSON.stringify(res.owned), personalCash: gm.personalCash + res.cashDelta } });
    revalidatePath("/gm/lifestyle");
    return { success: t("lifestyle.sold", { name, amount: formatSalary(res.cashDelta, locale) }) };
  }
  const res = purchase(owned, key, gm.personalCash);
  if (!res.ok) return { error: t(`lifestyle.error.${res.error}`) };
  await prisma.gmProfile.update({ where: { id: gm.id }, data: { lifestyleJson: JSON.stringify(res.owned), personalCash: gm.personalCash + res.cashDelta } });
  if (res.fans) {
    const state = await prisma.teamState.findFirst({ where: { careerId: membership.careerId, teamId: membership.teamId } });
    if (state) {
      await prisma.teamState.update({ where: { id: state.id }, data: { publicOpinion: Math.min(99, state.publicOpinion + res.fans) } });
    }
  }
  revalidatePath("/gm/lifestyle");
  revalidatePath("/gm");
  return { success: t("lifestyle.bought", { name }) };
}

"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";
import { recordTeamStint } from "@/lib/data-access/player-history";
import {
  clearNegotiation,
  getNegotiationView,
  recordWalkout,
  saveNegotiationRound,
} from "@/lib/data-access/negotiations";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { checkSalaryMove, type CapVerdict } from "@/lib/careers/cap-rules";
import { EXTENSION_MAX_YEARS_REMAINING } from "@/lib/careers/contract-type-rules";
import {
  CONTRACT_OPTIONS,
  WALKOUT_COOLDOWN_DAYS,
  evaluateOffer,
  validOffer,
  type ContractOption,
  type Offer,
} from "@/lib/careers/contract-negotiation-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

export interface NegotiationFormState {
  error?: string;
  success?: string;
  info?: string;
}

type T = Awaited<ReturnType<typeof getTranslator>>;

function capError(verdict: Exclude<CapVerdict, { ok: true }>, { t, locale }: T): string {
  const limit = formatSalary(verdict.limit, locale);
  if (verdict.reason === "minimum_only") return t("rosterAction.minimumOnly", { limit });
  if (verdict.reason === "apron") return t("rosterAction.exceedsApron", { limit });
  return t("rosterAction.exceedsCap", { cap: limit });
}

function optionSuffix(option: ContractOption, { t }: T): string {
  return option === "none" ? "" : ` (${t(`nego.option.${option}`).toLowerCase()})`;
}

// Un tour de négociation : le GM fait une offre (ou accepte la dernière
// contre-proposition du joueur) ; le joueur accepte, contre-propose ou part.
export async function negotiateContract(
  _prev: NegotiationFormState | undefined,
  formData: FormData
): Promise<NegotiationFormState> {
  const { userId } = await verifySession();
  const tr = await getTranslator();
  const { t, locale } = tr;
  const playerId = String(formData.get("playerId") ?? "");
  const acceptCounter = formData.get("mode") === "acceptCounter";

  const membership = await prisma.membership.findUnique({ where: { userId }, include: { career: true } });
  if (!membership) return { error: t("rosterAction.noCareer") };
  const { careerId, teamId } = membership;
  const { leagueId, season } = membership.career;

  const [player, contract, view] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.contract.findUnique({ where: { careerId_playerId: { careerId, playerId } } }),
    getNegotiationView({ careerId, leagueId, season, teamId, playerId }),
  ]);
  if (!player || player.leagueId !== leagueId || !view) return { error: t("rosterAction.dataNotFound") };
  const name = `${player.firstName} ${player.lastName}`;

  if (view.refuses) return { error: t("nego.refuses", { player: name }) };
  if (view.lockedDays !== null) return { error: t("nego.locked", { player: name, days: view.lockedDays }) };

  if (view.kind === "extension") {
    if (!contract || contract.yearsRemaining > EXTENSION_MAX_YEARS_REMAINING) return { error: t("rosterAction.notYetEligible") };
  } else {
    const rosterSize = await prisma.contract.count({ where: { careerId, teamId, contractType: "standard" } });
    if (rosterSize >= (MAX_ROSTER_SIZE[leagueId] ?? MAX_ROSTER_SIZE.nba)) return { error: t("nego.rosterFull") };
    if (!(await isFreeAgencyOpen(careerId, season))) return { error: t("nego.closed") };
  }

  let offer: Offer;
  if (acceptCounter) {
    if (!view.counter) return { error: t("rosterAction.invalidOffer") };
    offer = view.counter;
  } else {
    const option = String(formData.get("option") ?? "none") as ContractOption;
    offer = {
      salary: Math.round(Number(formData.get("salary"))),
      years: Math.round(Number(formData.get("years"))),
      option: CONTRACT_OPTIONS.includes(option) ? option : "none",
    };
  }
  if (!validOffer(offer, leagueId)) return { error: t("rosterAction.invalidOffer") };

  // Plafond vérifié avant de discuter : une offre impossible n'use pas la
  // patience de l'agent.
  const [payroll, league] = await Promise.all([getPayrollForTeam(careerId, teamId), getLeagueById(leagueId)]);
  const salaryCap = league?.salaryCap ?? Infinity;
  const capVerdict =
    view.kind === "extension"
      ? checkSalaryMove(leagueId, salaryCap, "extend", payroll - (contract?.salary ?? 0) + offer.salary, offer.salary)
      : checkSalaryMove(leagueId, salaryCap, "sign", payroll + offer.salary, offer.salary);
  if (!capVerdict.ok) return { error: capError(capVerdict, tr) };

  const verdict =
    acceptCounter || view.rookieScale ? ({ kind: "accept" } as const) : evaluateOffer(view.stance, offer, view.patienceLeft);

  const path = "/teams/[teamId]/players/[playerId]";
  if (verdict.kind === "counter") {
    await saveNegotiationRound({
      careerId,
      playerId,
      teamId,
      season,
      patienceLeft: verdict.patienceLeft,
      rounds: view.rounds + 1,
      counter: verdict.counter,
    });
    revalidatePath(path, "page");
    return {
      info: t("nego.counter", {
        player: name,
        amount: formatSalary(verdict.counter.salary, locale),
        years: verdict.counter.years,
        option: optionSuffix(verdict.counter.option, tr),
      }),
    };
  }
  if (verdict.kind === "walk") {
    await recordWalkout({ careerId, playerId, teamId, season });
    revalidatePath(path, "page");
    return { error: t("nego.walked", { player: name, days: WALKOUT_COOLDOWN_DAYS }) };
  }

  const optionType = offer.option === "none" ? null : offer.option;
  if (view.kind === "extension" && contract) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        salary: offer.salary,
        yearsRemaining: offer.years,
        guaranteed: true,
        isRookieScale: false,
        lastExtendedSeason: season, // voir evaluatePendingPromises, promesse "renewal"
        optionType,
        optionDeclined: false,
      },
    });
  } else {
    try {
      await prisma.contract.create({
        data: {
          careerId,
          playerId,
          teamId,
          salary: offer.salary,
          yearsRemaining: offer.years,
          guaranteed: true,
          optionType,
        },
      });
    } catch (err) {
      // P2002 : un autre manager l'a signé entre-temps.
      if (err instanceof Error && "code" in err && err.code === "P2002") return { error: t("rosterAction.dataNotFound") };
      throw err;
    }
    await recordTeamStint(careerId, playerId, teamId, season, "signed");
  }
  await clearNegotiation(careerId, playerId, teamId);

  revalidatePath("/");
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/free-agents");
  revalidatePath(path, "page");
  return {
    success: t(view.kind === "extension" ? "nego.extended" : "nego.signed", {
      player: name,
      amount: formatSalary(offer.salary, locale),
      years: offer.years,
      option: optionSuffix(offer.option, tr),
    }),
  };
}

// Option d'équipe sur la dernière année : le GM décide, tant que cette
// dernière année n'a pas commencé, s'il la lèvera à l'intersaison.
export async function setTeamOptionDeclined(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const declined = formData.get("value") === "true";
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId || contract.optionType !== "team" || contract.yearsRemaining < 2) {
    return;
  }
  await prisma.contract.update({ where: { id: contract.id }, data: { optionDeclined: declined } });
  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
}

"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { checkSalaryMove, type CapVerdict } from "@/lib/careers/cap-rules";
import { initialRenown } from "@/lib/careers/renown-rules";
import {
  minAcceptableSalary,
} from "@/lib/careers/player-demands";
import {
  ALT_CONTRACT_SALARY,
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

function revalidateRosterPaths(teamId: string) {
  revalidatePath("/");
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/free-agents");
}

export async function releasePlayer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  // On ne peut libérer qu'un joueur sous contrat avec SON PROPRE effectif.
  if (!contract || contract.teamId !== membership.teamId) return;

  // Seuls les contrats standard comptent pour le minimum d'effectif — les
  // contrats alternatifs (two-way/développement) sont des slots à part.
  const rosterSize = await prisma.contract.count({
    where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
  });
  const minRosterSize = MIN_ROSTER_SIZE[membership.career.leagueId] ?? MIN_ROSTER_SIZE.nba;
  if (contract.contractType === "standard" && rosterSize <= minRosterSize) return;

  await prisma.$transaction([
    prisma.contract.delete({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    // Un contrat garanti coupé avant terme laisse de l'argent mort qui
    // continue de compter dans le plafond de l'équipe — un contrat de 2e
    // tour de draft (non garanti) n'en laisse aucun.
    ...(contract.guaranteed
      ? [
          prisma.deadCap.create({
            data: {
              careerId: membership.careerId,
              teamId: membership.teamId,
              playerId,
              salary: contract.salary,
              yearsRemaining: contract.yearsRemaining,
            },
          }),
        ]
      : []),
    // Une joueuse coupée n'est plus le problème de ce GM — sans ce reset, une
    // promesse active resterait bloquée pour toujours si elle est re-signée
    // plus tard (y compris par un autre GM humain en multijoueur).
    prisma.playerState.updateMany({
      where: { careerId: membership.careerId, playerId },
      data: {
        wantsTrade: false,
        tradeRequestReasonsJson: null,
        tradeRequestSinceSeason: null,
        lastTradeRequestCheckDate: null,
        activePromiseType: null,
        activePromiseSeason: null,
        promiseOriginTeamId: null,
      },
    }),
  ]);

  revalidateRosterPaths(membership.teamId);
}

// Choix explicite du manager de faire jouer un joueur malgré une blessure
// mineure (au risque d'une récupération de conditionnement plus lente,
// d'une aggravation ou d'une nouvelle blessure — voir advanceRosterInjuries).
// Seulement valable pour SON PROPRE effectif et une blessure "minor" active.
export async function setPlayingThroughInjury(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const value = formData.get("value") === "true";

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;

  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!state || !state.injured || state.injurySeverity !== "minor") return;

  await prisma.playerState.update({
    where: { id: state.id },
    data: { playingThroughInjury: value },
  });

  revalidateRosterPaths(membership.teamId);
}

// Convertit un contrat standard en contrat alternatif (two-way NBA /
// développement WNBA) : salaire fixe bas, non garanti, exclu du plafond
// salarial et du roster standard — seulement pour un joueur éligible
// (approximé par l'âge) et si l'équipe a encore un slot alternatif dispo.
export async function offerAlternateContract(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;
  if (contract.contractType !== "standard") return;

  const [player, playerState, altSlotsUsed] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.contract.count({
      where: {
        careerId: membership.careerId,
        teamId: membership.teamId,
        contractType: { not: "standard" },
      },
    }),
  ]);
  if (!player) return;
  if (!isEligibleForAlternateContract(playerState?.age ?? player.age)) return;
  if (altSlotsUsed >= (ALT_CONTRACT_SLOTS_PER_TEAM[membership.career.leagueId] ?? 0)) return;

  const altType = ALT_CONTRACT_TYPE[membership.career.leagueId];
  if (!altType) return;

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      contractType: altType,
      salary: ALT_CONTRACT_SALARY[membership.career.leagueId] ?? contract.salary,
      yearsRemaining: 1,
      guaranteed: false,
      developmentGamesActivated: 0,
    },
  });

  revalidateRosterPaths(membership.teamId);
}

export interface PromoteContractFormState {
  error?: string;
  success?: string;
}

// Repasse un contrat alternatif (two-way NBA / développement WNBA) en
// contrat standard — seul moyen de lever le blocage d'activation à
// DEVELOPMENT_CONTRACT_GAME_LIMIT matchs d'une joueuse en développement (voir
// simulate-game/route.ts), mais utilisable aussi proactivement à tout
// moment. Le contrat alternatif ne portait qu'un salaire symbolique : un
// nouveau salaire standard est généré (même barème que la signature d'agent
// libre).
export async function promoteToStandardContract(
  _prevState: PromoteContractFormState | undefined,
  formData: FormData
): Promise<PromoteContractFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return { error: t("rosterAction.contractNotFound") };
  if (contract.contractType === "standard") return { error: t("rosterAction.alreadyStandard") };

  const [player, playerState, standardRosterSize, currentPayroll, league] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
    }),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.career.leagueId),
  ]);
  if (!player) return { error: t("rosterAction.dataNotFound") };

  const maxRosterSize = MAX_ROSTER_SIZE[membership.career.leagueId] ?? MAX_ROSTER_SIZE.nba;
  if (standardRosterSize >= maxRosterSize) return { error: t("rosterAction.noStandardRoom") };

  const renown = playerState?.renown ?? initialRenown(player.overallRating);
  const overallRating = playerState?.overallRating ?? player.overallRating;
  const terms = generateContractTerms(overallRating, membership.career.leagueId);
  const salary = Math.max(terms.salary, minAcceptableSalary(renown, overallRating, membership.career.leagueId));
  const salaryCap = league?.salaryCap ?? Infinity;
  // Un contrat alternatif est déjà exclu du plafond (voir getPayrollForTeam) :
  // pas besoin de retirer son ancien salaire de currentPayroll avant d'ajouter
  // le nouveau, contrairement à extendContract sur un contrat standard.
  const promoteVerdict = checkSalaryMove(membership.career.leagueId, salaryCap, "promote", currentPayroll + salary, salary);
  if (!promoteVerdict.ok) return { error: capErrorMessage(promoteVerdict, t, locale) };

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      contractType: "standard",
      salary,
      yearsRemaining: terms.yearsRemaining,
      guaranteed: true,
      developmentGamesActivated: 0,
    },
  });

  revalidateRosterPaths(membership.teamId);
  return {
    success: t("rosterAction.promoted", {
      player: `${player.firstName} ${player.lastName}`,
      amount: formatSalary(salary, locale),
    }),
  };
}

function capErrorMessage(
  verdict: Exclude<CapVerdict, { ok: true }>,
  t: Awaited<ReturnType<typeof getTranslator>>["t"],
  locale: Awaited<ReturnType<typeof getTranslator>>["locale"]
): string {
  const limit = formatSalary(verdict.limit, locale);
  if (verdict.reason === "minimum_only") return t("rosterAction.minimumOnly", { limit });
  if (verdict.reason === "apron") return t("rosterAction.exceedsApron", { limit });
  return t("rosterAction.exceedsCap", { cap: limit });
}

// Gestion de la charge (façon Football Manager) : met un joueur de MON
// effectif au repos pour le prochain match, ou annule — il récupère alors
// énergie et usure (voir wear-rules.ts) au lieu de jouer.
export async function setRestNextGame(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const value = formData.get("value") === "true";

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;

  await prisma.playerState.updateMany({
    where: { careerId: membership.careerId, playerId },
    data: { restNextGame: value },
  });
  revalidateRosterPaths(membership.teamId);
}

const INDIVIDUAL_FOCUSES = new Set(["offensive", "defensive", "tactical", "physical"]);

// Entraînement individuel d'un joueur de MON effectif ("" = suit le thème
// de l'équipe) — oriente sa progression en cours de saison (voir
// development-rules.ts).
export async function setIndividualFocus(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const focusRaw = String(formData.get("focus") ?? "");
  const focus = INDIVIDUAL_FOCUSES.has(focusRaw) ? focusRaw : null;

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;

  await prisma.playerState.updateMany({
    where: { careerId: membership.careerId, playerId },
    data: { individualFocus: focus },
  });
  revalidateRosterPaths(membership.teamId);
}

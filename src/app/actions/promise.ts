"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import { EXTENSION_MAX_YEARS_REMAINING } from "@/lib/careers/contract-type-rules";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { PROMISE_TYPES, type PromiseType } from "@/lib/careers/promise-rules";
import { clampMorale } from "@/lib/careers/morale-rules";
import {
  PROMISABLE_STATUSES,
  PROMISE_MORALE_ON_MAKE,
  playerStatus,
  promisableStatuses,
  rankInRoster,
  type PlayerStatus,
} from "@/lib/careers/player-status-rules";

export interface MakePromiseFormState {
  error?: string;
  success?: string;
}

// Réponse du GM à une joueuse qui veut être échangée — voir
// src/lib/data-access/trade-requests.ts (evaluatePendingPromises) pour la
// résolution en fin de saison. Une seule promesse active à la fois par
// joueuse (activePromiseType déjà posé bloque une nouvelle promesse tant que
// la précédente n'est pas résolue).
export async function makePromise(
  _prevState: MakePromiseFormState | undefined,
  formData: FormData
): Promise<MakePromiseFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");
  const promiseType = String(formData.get("promiseType") ?? "");

  if (!PROMISE_TYPES.includes(promiseType as PromiseType)) {
    return { error: t("promise.invalidType") };
  }

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

  const [contract, playerState] = await Promise.all([
    prisma.contract.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
  ]);
  if (!contract || contract.teamId !== membership.teamId) return { error: t("rosterAction.contractNotFound") };
  if (!playerState?.wantsTrade) return { error: t("promise.playerDoesNotWantTrade") };
  if (playerState.activePromiseType) return { error: t("promise.alreadyPending") };

  if (
    promiseType === "renewal" &&
    (contract.contractType !== "standard" || contract.yearsRemaining > EXTENSION_MAX_YEARS_REMAINING)
  ) {
    return { error: t("promise.renewalNotEligible") };
  }
  if (promiseType === "trade" && (await isTradeDeadlinePassed(membership.careerId, membership.career.season))) {
    return { error: t("promise.tradeDeadlinePassed") };
  }

  await prisma.playerState.update({
    where: { id: playerState.id },
    data: {
      activePromiseType: promiseType,
      activePromiseSeason: membership.career.season,
      promiseOriginTeamId: membership.teamId,
    },
  });

  revalidatePath(`/teams/${membership.teamId}/players/${playerId}`);
  return { success: t("promise.made") };
}

// Promesse de temps de jeu (voir player-status-rules.ts) : le GM promet un
// statut à l'un de ses joueurs. Jugée automatiquement après PROMISE_GAMES
// matchs (voir playing-time-promises.ts).
export async function promisePlayingTime(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const status = String(formData.get("status") ?? "") as PlayerStatus;
  if (!PROMISABLE_STATUSES.includes(status)) return;
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId) });
  if (!membership) return;
  const [contract, state, lastGame] = await Promise.all([
    prisma.contract.findUnique({ where: { careerId_playerId: { careerId: membership.careerId, playerId } } }),
    prisma.playerState.findUnique({ where: { careerId_playerId: { careerId: membership.careerId, playerId } } }),
    prisma.game.findFirst({ where: { careerId: membership.careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  if (!contract || contract.teamId !== membership.teamId || !state || state.promisedStatus) return;
  // Même garde-fou que l'interface : rôle actuel garanti, ou jusqu'à trois crans au-dessus.
  const mates = await prisma.contract.findMany({
    where: { careerId: membership.careerId, teamId: membership.teamId, playerId: { not: playerId } },
    select: { playerId: true },
  });
  const mateOveralls = (
    await prisma.playerState.findMany({
      where: { careerId: membership.careerId, playerId: { in: mates.map((m) => m.playerId) } },
      select: { overallRating: true },
    })
  ).map((m) => m.overallRating);
  const current = playerStatus({
    overall: state.overallRating,
    renown: state.renown,
    age: state.age,
    potential: state.potential || state.overallRating,
    teamRank: rankInRoster(state.overallRating, mateOveralls),
  });
  if (!promisableStatuses(current).includes(status)) return;
  await prisma.playerState.update({
    where: { id: state.id },
    data: {
      promisedStatus: status,
      promiseSince: lastGame?.gameDate ?? new Date(0),
      morale: clampMorale(state.morale + PROMISE_MORALE_ON_MAKE),
    },
  });
  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
}

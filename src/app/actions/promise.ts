"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import { EXTENSION_MAX_YEARS_REMAINING } from "@/lib/careers/contract-type-rules";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { PROMISE_TYPES, type PromiseType } from "@/lib/careers/promise-rules";

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

  const membership = await prisma.membership.findUnique({
    where: { userId },
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

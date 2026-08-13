"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getTranslator } from "@/lib/i18n/translate";

export interface RotationOrderFormState {
  error?: string;
  success?: string;
}

// Ordre de rotation choisi par le GM (5 majeures, 6ème femme, banc — voir
// rotationOf dans simulation/mockEngine.ts, qui l'utilise comme priorité
// devant le tri automatique par playerImpact). N'exige pas que la liste
// couvre tout l'effectif : une joueuse de profondeur non classée retombe
// simplement sur le départage automatique, c'est volontaire.
export async function setRotationOrder(
  _prevState: RotationOrderFormState | undefined,
  formData: FormData
): Promise<RotationOrderFormState> {
  const { userId } = await verifySession();
  const { t } = await getTranslator();

  let order: unknown;
  try {
    order = JSON.parse(String(formData.get("order") ?? ""));
  } catch {
    return { error: t("rotation.invalidOrder") };
  }
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
    return { error: t("rotation.invalidOrder") };
  }
  if (new Set(order).size !== order.length) {
    return { error: t("rotation.invalidOrder") };
  }

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

  const contracts = await prisma.contract.findMany({
    where: { careerId: membership.careerId, teamId: membership.teamId },
    select: { playerId: true },
  });
  const validIds = new Set(contracts.map((c) => c.playerId));
  if (!order.every((id) => validIds.has(id))) {
    return { error: t("rotation.unknownPlayer") };
  }

  const state = await getOrCreateTeamState(
    membership.careerId,
    membership.teamId,
    membership.career.leagueId
  );

  await prisma.teamState.update({
    where: { id: state.id },
    data: { rotationOrderJson: JSON.stringify(order) },
  });

  revalidatePath(`/teams/${membership.teamId}`);
  return { success: t("rotation.saved") };
}

"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { prisma } from "@/lib/prisma";
import {
  PROTOCOL_GAMES,
  RETURN_PROTOCOLS,
  protocolAllowed,
  rushedRemaining,
  type ReturnProtocol,
} from "@/lib/careers/return-protocol-rules";
import { AUTO_REST_WEAR_LEVELS, MINUTES_LIMITS, isEmptyPlan, type LoadPlan } from "@/lib/careers/load-plan-rules";

// Choix du protocole de retour d'un de mes joueurs blessés (modéré ou grave).
// Le retour accéléré raccourcit l'absence une seule fois ; changer d'avis
// ensuite ne la rallonge pas.
export async function setReturnProtocol(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const protocol = String(formData.get("protocol") ?? "") as ReturnProtocol;
  if (!RETURN_PROTOCOLS.includes(protocol)) return;
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId) });
  if (!membership) return;
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;
  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!state || !state.injured || !protocolAllowed(state.injurySeverity)) return;
  const alreadyRushed = state.returnProtocol === "rushed";
  await prisma.playerState.update({
    where: { id: state.id },
    data: {
      returnProtocol: protocol === "standard" ? null : protocol,
      protocolGamesLeft: PROTOCOL_GAMES[protocol],
      ...(protocol === "rushed" && !alreadyRushed ? { injuryGamesRemaining: rushedRemaining(state.injuryGamesRemaining) } : {}),
    },
  });
  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
  revalidatePath(`/teams/${membership.teamId}`);
}

// Plan de gestion de la charge d'un de mes joueurs (voir load-plan-rules.ts).
export async function saveLoadPlan(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId) });
  if (!membership) return;
  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;
  const minutes = Number(formData.get("minutesLimit"));
  const wear = Number(formData.get("autoRestWear"));
  const plan: LoadPlan = {
    restOnBackToBacks: formData.get("restOnBackToBacks") === "on",
    minutesLimit: MINUTES_LIMITS.includes(minutes) ? minutes : null,
    autoRestWear: AUTO_REST_WEAR_LEVELS.includes(wear) ? wear : null,
  };
  await prisma.playerState.updateMany({
    where: { careerId: membership.careerId, playerId },
    data: { loadPlanJson: isEmptyPlan(plan) ? null : JSON.stringify(plan) },
  });
  revalidatePath("/teams/[teamId]/players/[playerId]", "page");
  revalidatePath(`/teams/${membership.teamId}`);
}

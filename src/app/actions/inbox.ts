"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { markInboxMessageRead, markAllInboxMessagesRead } from "@/lib/data-access/inbox";

// Un champ caché "messageId" par formulaire — même principe que
// submitPressAnswers (conferenceId) : chaque message a son propre bouton
// "Marquer comme lu".
export async function markMessageRead(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return;

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  await markInboxMessageRead(membership.careerId, messageId);

  revalidatePath("/inbox");
  revalidatePath("/", "layout");
}

export async function markAllMessagesRead(): Promise<void> {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  await markAllInboxMessagesRead(membership.careerId, membership.teamId);

  revalidatePath("/inbox");
  revalidatePath("/", "layout");
}

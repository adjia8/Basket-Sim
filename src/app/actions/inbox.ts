"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { markInboxMessageRead, markAllInboxMessagesRead } from "@/lib/data-access/inbox";
import { acceptPoachOffer, declinePoachOffer } from "./gm";

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

// Action d'un message (bouton « Voir le joueur », « Gérer la rotation »…) :
// le message est marqué lu, puis on suit le lien — comme ouvrir un message
// dans Football Manager. `href` interne uniquement (jamais de redirection
// vers un autre site).
export async function openMessage(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const messageId = String(formData.get("messageId") ?? "");
  const href = String(formData.get("href") ?? "");
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (membership && messageId) await markInboxMessageRead(membership.careerId, messageId);
  revalidatePath("/", "layout");
  redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/inbox");
}

// Offre d'une autre franchise (message "poach_offer") : accepter ou refuser
// directement depuis le message.
export async function respondToPoachFromInbox(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const messageId = String(formData.get("messageId") ?? "");
  const accept = formData.get("decision") === "accept";
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;
  if (messageId) await markInboxMessageRead(membership.careerId, messageId);
  if (accept) {
    await acceptPoachOffer();
    redirect("/");
  }
  await declinePoachOffer();
  revalidatePath("/", "layout");
}

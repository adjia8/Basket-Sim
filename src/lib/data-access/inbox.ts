import "server-only";
import { prisma } from "@/lib/prisma";

export interface InboxMessageView {
  id: string;
  type: string;
  title: string;
  body: string;
  linkHref: string | null;
  status: string;
  createdAt: string; // ISO
  // Date du jeu (ISO) — repli sur createdAt pour les messages antérieurs à
  // ce champ ou créés hors calendrier.
  gameDate: string | null;
  playerId: string | null;
}

function toView(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  linkHref: string | null;
  status: string;
  createdAt: Date;
  gameDate: Date | null;
  playerId: string | null;
}): InboxMessageView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkHref: row.linkHref,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    gameDate: row.gameDate?.toISOString() ?? null,
    playerId: row.playerId,
  };
}

// Appelée depuis les générateurs de messages (press.ts, trade-requests.ts,
// simulate.ts, actions/season.ts) — jamais directement depuis une page.
export async function createInboxMessage(
  careerId: string,
  teamId: string,
  season: string,
  type: string,
  title: string,
  body: string,
  linkHref?: string | null,
  context: { gameDate?: Date | null; playerId?: string | null } = {}
): Promise<void> {
  await prisma.inboxMessage.create({
    data: {
      careerId,
      teamId,
      season,
      type,
      title,
      body,
      linkHref: linkHref ?? null,
      gameDate: context.gameDate ?? null,
      playerId: context.playerId ?? null,
    },
  });
}

export async function getInboxMessages(
  careerId: string,
  teamId: string
): Promise<{ unread: InboxMessageView[]; read: InboxMessageView[] }> {
  const rows = await prisma.inboxMessage.findMany({
    where: { careerId, teamId },
    orderBy: { createdAt: "desc" },
  });
  return {
    unread: rows.filter((r) => r.status === "unread").map(toView),
    read: rows.filter((r) => r.status === "read").map(toView),
  };
}

export async function getUnreadInboxCount(careerId: string, teamId: string): Promise<number> {
  return prisma.inboxMessage.count({ where: { careerId, teamId, status: "unread" } });
}

export async function markInboxMessageRead(careerId: string, messageId: string): Promise<void> {
  await prisma.inboxMessage.updateMany({
    where: { id: messageId, careerId },
    data: { status: "read" },
  });
}

export async function markAllInboxMessagesRead(careerId: string, teamId: string): Promise<void> {
  await prisma.inboxMessage.updateMany({
    where: { careerId, teamId, status: "unread" },
    data: { status: "read" },
  });
}

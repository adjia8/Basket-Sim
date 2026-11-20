import "server-only";
import { prisma } from "@/lib/prisma";
import {
  categoryOf,
  defaultPriority,
  isPriority,
  sortMessages,
  type InboxCategory,
  type InboxPriority,
} from "@/lib/careers/inbox-priority-rules";

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
  priority: InboxPriority;
  category: InboxCategory;
  unread: boolean;
  date: string; // date de jeu, sinon création (tri)
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
  priority: string;
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
    priority: isPriority(row.priority) ? row.priority : defaultPriority(row.type),
    category: categoryOf(row.type),
    unread: row.status === "unread",
    date: (row.gameDate ?? row.createdAt).toISOString(),
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
  context: { gameDate?: Date | null; playerId?: string | null; priority?: InboxPriority } = {}
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
      priority: context.priority ?? defaultPriority(type),
    },
  });
}

export interface LeagueNewsView {
  id: string;
  type: string;
  title: string;
  body: string;
  date: string;
}

export interface InboxView {
  messages: InboxMessageView[]; // triés : non lus (urgents en tête) puis récents
  unreadByCategory: Partial<Record<InboxCategory, number>>;
  urgentUnread: number;
  seasons: string[]; // saisons ayant des messages, la plus récente d'abord
  season: string;
  leagueNews: LeagueNewsView[]; // onglet « Ligue »
}

const baseSeasonOf = (season: string) => season.replace(/-(playoffs|preseason|cup)$/, "");

// Boîte de réception d'une saison (par défaut la saison en cours), filtrée
// par catégorie. Les messages des phases d'une même saison (pré-saison,
// Coupe, playoffs) sont regroupés avec elle.
export async function getInbox(
  careerId: string,
  teamId: string,
  opts: { season: string; category?: InboxCategory | null }
): Promise<InboxView> {
  const season = baseSeasonOf(opts.season);
  const seasonLabels = [season, `${season}-preseason`, `${season}-cup`, `${season}-playoffs`];
  const [rows, seasonRows, news] = await Promise.all([
    prisma.inboxMessage.findMany({
      where: { careerId, teamId, season: { in: seasonLabels } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.inboxMessage.findMany({ where: { careerId, teamId }, distinct: ["season"], select: { season: true } }),
    opts.category === "league"
      ? prisma.leagueNews.findMany({
          where: { careerId, season: { in: seasonLabels } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);
  const all = rows.map(toView);
  const unreadByCategory: Partial<Record<InboxCategory, number>> = {};
  for (const m of all) if (m.unread) unreadByCategory[m.category] = (unreadByCategory[m.category] ?? 0) + 1;
  const seasons = [...new Set([season, ...seasonRows.map((r) => baseSeasonOf(r.season))])].sort().reverse();
  return {
    messages: sortMessages(opts.category ? all.filter((m) => m.category === opts.category) : all),
    unreadByCategory,
    urgentUnread: all.filter((m) => m.unread && m.priority === "urgent").length,
    seasons,
    season,
    leagueNews: news.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      date: (n.gameDate ?? n.createdAt).toISOString(),
    })),
  };
}

export async function getInboxMessage(careerId: string, teamId: string, id: string): Promise<InboxMessageView | null> {
  const row = await prisma.inboxMessage.findFirst({ where: { id, careerId, teamId } });
  return row ? toView(row) : null;
}

// Messages urgents non lus : « Continuer » s'arrête dessus (voir
// simulate-bulk.ts continueGame).
export async function countUrgentUnread(careerId: string, teamId: string): Promise<number> {
  return prisma.inboxMessage.count({ where: { careerId, teamId, status: "unread", priority: "urgent" } });
}

export async function markUrgentInboxMessagesRead(careerId: string, teamId: string): Promise<void> {
  await prisma.inboxMessage.updateMany({
    where: { careerId, teamId, status: "unread", priority: "urgent" },
    data: { status: "read" },
  });
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

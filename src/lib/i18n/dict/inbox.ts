export const keys = [
  "inbox.title",
  "inbox.unreadHeading",
  "inbox.readHeading",
  "inbox.noUnread",
  "inbox.noRead",
  "inbox.markRead",
  "inbox.markAllRead",
  "inbox.viewLink",
] as const;

export type InboxKey = (typeof keys)[number];

export const fr: Record<InboxKey, string> = {
  "inbox.title": "Boîte de réception",
  "inbox.unreadHeading": "Non lus",
  "inbox.readHeading": "Lus",
  "inbox.noUnread": "Aucun nouveau message.",
  "inbox.noRead": "Aucun message lu pour l'instant.",
  "inbox.markRead": "Marquer comme lu",
  "inbox.markAllRead": "Tout marquer comme lu",
  "inbox.viewLink": "Consulter",
};

export const en: Record<InboxKey, string> = {
  "inbox.title": "Inbox",
  "inbox.unreadHeading": "Unread",
  "inbox.readHeading": "Read",
  "inbox.noUnread": "No new messages.",
  "inbox.noRead": "No read messages yet.",
  "inbox.markRead": "Mark as read",
  "inbox.markAllRead": "Mark all as read",
  "inbox.viewLink": "View",
};

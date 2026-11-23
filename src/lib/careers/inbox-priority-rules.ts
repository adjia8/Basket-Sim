// Boîte de réception façon Football Manager — règles pures (catégories,
// importance, regroupement des infos mineures), sans accès base de données.
//
// Trois niveaux d'importance :
// - urgent : demande une réaction du GM (joueur qui veut partir ou te parler,
//   offre d'échange ou de poste, blessure grave d'un joueur important) — le
//   bouton « Continuer » s'arrête dessus ;
// - important : à connaître (blessure légère, contrat, direction, Coupe,
//   trophée, réaction négative d'un joueur…) ;
// - info : le reste (classement, revue de presse…), regroupé quand il y en a
//   beaucoup le même jour.

export type InboxPriority = "urgent" | "important" | "info";
export const INBOX_PRIORITIES: InboxPriority[] = ["urgent", "important", "info"];

export type InboxCategory = "team" | "medical" | "transfers" | "press" | "board" | "competitions" | "league";
export const INBOX_CATEGORIES: InboxCategory[] = ["team", "medical", "transfers", "press", "board", "competitions", "league"];

const CATEGORY_BY_TYPE: Record<string, InboxCategory> = {
  player_request: "team",
  roster: "team",
  player_reaction: "team",
  injury: "medical",
  league_injury: "medical",
  trade_request: "transfers",
  trade_offer: "transfers",
  trade_reaction: "transfers",
  free_agent: "transfers",
  free_agency: "transfers",
  contract: "transfers",
  press: "press",
  press_review: "press",
  fine: "press",
  board: "board",
  staff: "board",
  facility: "board",
  poach_offer: "board",
  standings: "competitions",
  cup: "competitions",
  award: "competitions",
  season_end: "competitions",
};

export function categoryOf(type: string): InboxCategory {
  return CATEGORY_BY_TYPE[type] ?? "team";
}

const PRIORITY_BY_TYPE: Record<string, InboxPriority> = {
  trade_request: "urgent",
  roster: "urgent",
  player_request: "urgent",
  trade_offer: "urgent",
  poach_offer: "urgent",
  injury: "important",
  league_injury: "important",
  contract: "important",
  board: "important",
  fine: "important",
  free_agency: "important",
  free_agent: "important",
  cup: "important",
  award: "important",
  staff: "important",
  press: "important",
  player_reaction: "info",
  press_review: "info",
  standings: "info",
};

export function defaultPriority(type: string): InboxPriority {
  return PRIORITY_BY_TYPE[type] ?? "info";
}

// Blessure : urgente si elle touche un joueur important pour longtemps.
export function injuryPriority(severity: string, gamesOut: number, renown: number): InboxPriority {
  if (severity === "severe" || (gamesOut >= 10 && renown >= 60)) return "urgent";
  if (severity === "moderate" || renown >= 70) return "important";
  return "info";
}

// Blessure d'une star d'une autre équipe : importante seulement pour une
// superstar (note 88+) ; les autres stars passent en info (regroupées).
export function leagueInjuryPriority(overall: number): InboxPriority {
  return overall >= 88 ? "important" : "info";
}

export function isPriority(value: string | null | undefined): value is InboxPriority {
  return value === "urgent" || value === "important" || value === "info";
}

const RANK: Record<InboxPriority, number> = { urgent: 0, important: 1, info: 2 };

export interface SortableMessage {
  id: string;
  priority: InboxPriority;
  unread: boolean;
  date: string; // ISO (date de jeu, sinon création)
}

// Non lus d'abord (urgents épinglés en tête), puis du plus récent au plus
// ancien.
export function sortMessages<T extends SortableMessage>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    if (a.unread && RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
    return b.date.localeCompare(a.date);
  });
}

export type InboxRow<T> = { kind: "message"; message: T } | { kind: "digest"; day: string; messages: T[] };

// Regroupe les infos d'une même journée quand il y en a au moins `min` :
// une seule ligne « N infos » au lieu d'une liste qui noie l'essentiel.
export function withDigests<T extends SortableMessage>(sorted: T[], min = 3): InboxRow<T>[] {
  const infoByDay = new Map<string, T[]>();
  for (const m of sorted) {
    if (m.priority !== "info") continue;
    const day = m.date.slice(0, 10);
    infoByDay.set(day, [...(infoByDay.get(day) ?? []), m]);
  }
  const rows: InboxRow<T>[] = [];
  const done = new Set<string>();
  for (const m of sorted) {
    const day = m.date.slice(0, 10);
    const group = m.priority === "info" ? infoByDay.get(day) ?? [] : [];
    if (group.length >= min) {
      if (done.has(day)) continue;
      done.add(day);
      rows.push({ kind: "digest", day, messages: group });
    } else {
      rows.push({ kind: "message", message: m });
    }
  }
  return rows;
}

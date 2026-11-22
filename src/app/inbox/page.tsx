import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getInbox, getInboxMessage, markInboxMessageRead } from "@/lib/data-access/inbox";
import { INBOX_CATEGORIES, withDigests, type InboxCategory, type InboxPriority } from "@/lib/careers/inbox-priority-rules";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { markMessageRead, markAllMessagesRead, openInboxMessage, openMessage, respondToPoachFromInbox } from "@/app/actions/inbox";
import { prisma } from "@/lib/prisma";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatGameDate, playerHref } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";
import type { InboxMessageView } from "@/lib/data-access/inbox";

// Couleur de la pastille de type (repère visuel façon Football Manager).
const TYPE_TONE: Record<string, string> = {
  injury: "bg-bad/15 text-bad",
  league_injury: "bg-bad/10 text-bad",
  trade_request: "bg-warn/15 text-warn",
  poach_offer: "bg-accent/15 text-accent-text",
  free_agent: "bg-info/15 text-info",
  free_agency: "bg-info/15 text-info",
  press: "bg-surface-3 text-soft",
  standings: "bg-surface-3 text-soft",
  press_review: "bg-surface-3 text-soft",
  player_reaction: "bg-warn/15 text-warn",
  fine: "bg-bad/15 text-bad",
  staff: "bg-info/15 text-info",
  trade_offer: "bg-accent/15 text-accent-text",
  award: "bg-good/15 text-good",
};

interface MessageAction {
  label: string;
  href: string;
  primary?: boolean;
}

// Actions proposées par type de message — chacune marque le message comme
// lu avant d'ouvrir sa cible (voir openMessage).
function actionsFor(message: InboxMessageView, teamId: string, t: Translator): MessageAction[] {
  switch (message.type) {
    case "injury":
      return [
        ...(message.playerId
          ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId, teamId), primary: true }]
          : []),
        { label: t("inbox.action.manageRotation"), href: `/teams/${teamId}?tab=rotation` },
      ];
    case "roster":
      return [{ label: t("inbox.action.manageRoster"), href: `/teams/${teamId}`, primary: true }];
    case "league_injury":
      return [
        { label: t("inbox.action.injuryReport"), href: "/injuries", primary: true },
        ...(message.playerId ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId) }] : []),
      ];
    case "trade_request":
      return message.playerId
        ? [{ label: t("inbox.action.respondPlayer"), href: playerHref(message.playerId, teamId), primary: true }]
        : [];
    case "free_agent":
      return [
        ...(message.playerId
          ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId), primary: true }]
          : []),
        { label: t("inbox.action.freeAgents"), href: "/free-agents" },
      ];
    case "free_agency":
      return [{ label: t("inbox.action.freeAgents"), href: "/free-agents", primary: true }];
    case "press":
      return [{ label: t("inbox.action.answerPress"), href: "/press", primary: true }];
    case "trade_offer":
      return [{ label: t("inbox.action.viewTrades"), href: "/trades", primary: true }];
    case "player_request":
    case "contract":
    case "award":
      return message.playerId
        ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId, teamId), primary: true }]
        : [];
    case "staff":
      return [{ label: t("inbox.action.staffPage"), href: "/staff", primary: true }];
    case "cup":
      return [{ label: t("cup.title"), href: "/cup", primary: true }];
    case "board":
      return [{ label: t("board.title"), href: "/gm", primary: true }];
    case "press_review":
      return [{ label: t("inbox.action.pressRoom"), href: "/press" }];
    case "player_reaction":
      return [
        ...(message.playerId
          ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId, teamId), primary: true }]
          : []),
        { label: t("inbox.action.pressRoom"), href: "/press" },
      ];
    case "standings":
      return [{ label: t("inbox.action.viewStandings"), href: "/standings" }];
    case "poach_offer":
      return [{ label: t("inbox.action.viewOffer"), href: "/gm" }];
    default:
      return message.linkHref ? [{ label: t("inbox.viewLink"), href: message.linkHref }] : [];
  }
}

const PRIORITY_DOT: Record<InboxPriority, string> = {
  urgent: "bg-bad",
  important: "bg-warn",
  info: "bg-faint",
};

type InboxSearch = { cat?: string; season?: string; m?: string };

function inboxHref(params: InboxSearch): string {
  const q = new URLSearchParams();
  if (params.cat) q.set("cat", params.cat);
  if (params.season) q.set("season", params.season);
  if (params.m) q.set("m", params.m);
  const qs = q.toString();
  return qs ? `/inbox?${qs}` : "/inbox";
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<InboxSearch> }) {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const params = await searchParams;
  const category = INBOX_CATEGORIES.includes(params.cat as InboxCategory) ? (params.cat as InboxCategory) : null;
  const season = params.season && /^\d{4}-\d{4}$/.test(params.season) ? params.season : membership.season;

  // Ouvrir un message (?m=…) le marque comme lu, comme dans Football Manager.
  const opened = params.m ? await getInboxMessage(membership.careerId, membership.teamId, params.m) : null;
  if (opened?.unread) await markInboxMessageRead(membership.careerId, opened.id);

  const [inbox, pendingTradeOffers, gmProfile, pendingPress] = await Promise.all([
    getInbox(membership.careerId, membership.teamId, { season, category }),
    prisma.tradeOffer.count({
      where: { careerId: membership.careerId, toTeamId: membership.teamId, status: "pending" },
    }),
    prisma.gmProfile.findUnique({ where: { membershipId: membership.id }, select: { pendingOfferTeamId: true } }),
    prisma.pressConference.count({ where: { careerId: membership.careerId, teamId: membership.teamId, status: "pending" } }),
  ]);
  const hasPendingPoachOffer = Boolean(gmProfile?.pendingOfferTeamId);

  // « Action requise » : le message attend encore une décision (joueur qui
  // veut te parler ou partir, offre d'échange, conférence, offre de poste).
  const playerIds = inbox.messages
    .filter((m) => (m.type === "player_request" || m.type === "trade_request") && m.playerId)
    .map((m) => m.playerId!);
  const states = playerIds.length
    ? await prisma.playerState.findMany({
        where: { careerId: membership.careerId, playerId: { in: playerIds } },
        select: { playerId: true, pendingRequest: true, wantsTrade: true },
      })
    : [];
  const stateById = new Map(states.map((s) => [s.playerId, s]));
  const newest = new Map<string, string>();
  for (const m of [...inbox.messages].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = `${m.type}:${m.playerId ?? ""}`;
    if (!newest.has(key)) newest.set(key, m.id);
  }
  const actionRequired = (m: InboxMessageView): boolean => {
    if (newest.get(`${m.type}:${m.playerId ?? ""}`) !== m.id) return false;
    switch (m.type) {
      case "player_request":
        return !!m.playerId && !!stateById.get(m.playerId)?.pendingRequest;
      case "trade_request":
        return !!m.playerId && !!stateById.get(m.playerId)?.wantsTrade;
      case "press":
        return pendingPress > 0;
      case "trade_offer":
        return pendingTradeOffers > 0;
      case "poach_offer":
        return hasPendingPoachOffer;
      default:
        return false;
    }
  };

  const selected = opened ? { ...opened, unread: false } : null;
  const totalUnread = Object.values(inbox.unreadByCategory).reduce((s, n) => s + (n ?? 0), 0);
  const base = { cat: category ?? undefined, season: season === membership.season ? undefined : season };
  const rows = withDigests(inbox.messages);

  const row = (m: InboxMessageView) => {
    const active = selected?.id === m.id;
    return (
      <form key={m.id} action={openInboxMessage}>
        <input type="hidden" name="messageId" value={m.id} />
        <input type="hidden" name="back" value={inboxHref(base)} />
        <button
          type="submit"
          data-testid="inbox-row"
          className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2 ${active ? "bg-surface-2" : ""}`}
        >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[m.priority]}`} title={t(`inbox.priority.${m.priority}` as DictionaryKey)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-2xs text-faint">
            <span className="uppercase tracking-wide">{typeLabel(m.type, t)}</span>
            <span>{m.gameDate ? formatGameDate(m.gameDate, locale) : t("inbox.offseason")}</span>
            {actionRequired(m) && <span className="rounded bg-accent/15 px-1.5 font-semibold text-accent-text">{t("inbox.actionRequired")}</span>}
          </span>
          <span className={`block truncate text-sm ${m.unread ? "font-semibold" : "text-soft"}`}>{m.title}</span>
        </span>
        </button>
      </form>
    );
  };

  const tabs: { key: InboxCategory | null; label: string }[] = [
    { key: null, label: t("inbox.category.all") },
    ...INBOX_CATEGORIES.map((c) => ({ key: c, label: t(`inbox.category.${c}` as DictionaryKey) })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("inbox.title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {inbox.seasons.length > 1 && (
            <nav className="flex gap-1 text-xs" aria-label={t("inbox.season")}>
              {inbox.seasons.map((s) => (
                <Link
                  key={s}
                  href={inboxHref({ cat: base.cat, season: s === membership.season ? undefined : s })}
                  className={`rounded px-2 py-1 ${s === inbox.season ? "bg-surface-3 font-semibold" : "text-muted hover:bg-surface-2"}`}
                >
                  {s}
                </Link>
              ))}
            </nav>
          )}
          {totalUnread > 0 && (
            <form action={markAllMessagesRead}>
              <button type="submit" className="rounded-md bg-surface-2 px-3 py-1.5 text-sm transition hover:bg-surface-3">
                {t("inbox.markAllRead")}
              </button>
            </form>
          )}
        </div>
      </div>

      {(inbox.urgentUnread > 0 || pendingTradeOffers > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3" data-testid="inbox-urgent">
          <p className="text-sm font-medium">
            {inbox.urgentUnread > 0 && t("inbox.urgentBanner", { count: inbox.urgentUnread })}
            {inbox.urgentUnread > 0 && pendingTradeOffers > 0 && " · "}
            {pendingTradeOffers > 0 && t("inbox.pendingTradeOffers", { count: pendingTradeOffers })}
          </p>
          {pendingTradeOffers > 0 && (
            <Link href="/trades" className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover">
              {t("inbox.action.viewTrades")}
            </Link>
          )}
        </div>
      )}

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line-soft pb-px text-sm" data-testid="inbox-tabs">
        {tabs.map((tab) => {
          const count = tab.key ? inbox.unreadByCategory[tab.key] ?? 0 : totalUnread;
          const active = tab.key === category;
          return (
            <Link
              key={tab.key ?? "all"}
              href={inboxHref({ cat: tab.key ?? undefined, season: base.season })}
              className={`shrink-0 border-b-2 px-3 py-2 ${active ? "border-accent font-semibold" : "border-transparent text-muted hover:text-fg"}`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-2xs font-bold text-accent-fg">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {category === "league" ? (
        <section className="mt-4 space-y-3" data-testid="inbox-league">
          {inbox.leagueNews.length === 0 ? (
            <p className="text-sm text-muted">{t("inbox.leagueEmpty")}</p>
          ) : (
            inbox.leagueNews.map((n) => (
              <div key={n.id} className="card p-4">
                <p className="text-2xs text-faint">{formatGameDate(n.date, locale)}</p>
                <p className="mt-1 font-semibold">{n.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-soft">{n.body}</p>
              </div>
            ))
          )}
        </section>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className={`card overflow-hidden ${selected ? "hidden lg:block" : ""}`} data-testid="inbox-list">
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted">{t("inbox.empty")}</p>
            ) : (
              <div className="divide-y divide-line-soft">
                {rows.map((r) =>
                  r.kind === "message" ? (
                    row(r.message)
                  ) : (
                    <details key={`digest-${r.day}`} className="group" open={r.messages.some((m) => m.id === selected?.id)}>
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 text-sm text-muted hover:bg-surface-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT.info}`} />
                        <span className="flex-1">
                          {t("inbox.digest", { count: r.messages.length })} · {formatGameDate(r.messages[0].date, locale)}
                          {r.messages.some((m) => m.unread) && <span className="ml-2 text-accent-text">●</span>}
                        </span>
                        <span className="transition group-open:rotate-90">›</span>
                      </summary>
                      <div className="divide-y divide-line-soft bg-surface/40 pl-3">{r.messages.map(row)}</div>
                    </details>
                  )
                )}
              </div>
            )}
          </section>

          <section className={selected ? "" : "hidden lg:block"}>
            {selected ? (
              <div className="space-y-3">
                <Link href={inboxHref(base)} scroll={false} className="text-sm text-muted hover:text-fg lg:hidden">
                  ← {t("inbox.back")}
                </Link>
                <MessageCard
                  message={selected}
                  isUnread={false}
                  locale={locale}
                  t={t}
                  actions={actionsFor(selected, membership.teamId, t)}
                  poachDecision={selected.type === "poach_offer" && hasPendingPoachOffer}
                  actionRequired={actionRequired(selected)}
                />
              </div>
            ) : (
              <div className="card flex h-40 items-center justify-center p-4 text-sm text-muted">{t("inbox.selectMessage")}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function typeLabel(type: string, t: Translator): string {
  return KNOWN_TYPES.includes(type) ? t(`inbox.type.${type}` as DictionaryKey) : type;
}

const KNOWN_TYPES = ["roster", "league_injury", "press", "injury", "trade_request", "free_agent", "free_agency", "standings", "poach_offer", "press_review", "player_reaction", "fine", "staff", "trade_offer", "award", "contract", "cup", "board", "player_request"];

function MessageCard({
  message,
  isUnread,
  locale,
  t,
  actions,
  poachDecision,
  actionRequired,
}: {
  message: InboxMessageView;
  isUnread: boolean;
  locale: Locale;
  t: Translator;
  actions: MessageAction[];
  poachDecision: boolean;
  actionRequired: boolean;
}) {
  return (
    <div className="card relative overflow-hidden p-4" data-testid="inbox-message">
      {isUnread && <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${TYPE_TONE[message.type] ?? "bg-surface-3 text-soft"}`}>
          {typeLabel(message.type, t)}
        </span>
        <span className="flex items-center gap-1 text-faint">
          <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[message.priority]}`} />
          {t(`inbox.priority.${message.priority}` as DictionaryKey)}
        </span>
        {actionRequired && <span className="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent-text">{t("inbox.actionRequired")}</span>}
        <span className="text-faint">
          {message.gameDate ? formatGameDate(message.gameDate, locale) : t("inbox.offseason")}
        </span>
      </div>
      <p className={`mt-2 ${isUnread ? "font-semibold" : "font-medium"}`}>{message.title}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-soft">{message.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {poachDecision && (
          <>
            <form action={respondToPoachFromInbox}>
              <input type="hidden" name="messageId" value={message.id} />
              <input type="hidden" name="decision" value="accept" />
              <button
                type="submit"
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
              >
                {t("inbox.action.acceptOffer")}
              </button>
            </form>
            <form action={respondToPoachFromInbox}>
              <input type="hidden" name="messageId" value={message.id} />
              <input type="hidden" name="decision" value="decline" />
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                {t("inbox.action.declineOffer")}
              </button>
            </form>
          </>
        )}
        {actions.map((action) => (
          <form key={action.href + action.label} action={openMessage}>
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="href" value={action.href} />
            <button
              type="submit"
              className={
                action.primary && !poachDecision
                  ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                  : "rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              }
            >
              {action.label}
            </button>
          </form>
        ))}
        {isUnread && (
          <form action={markMessageRead} className="ml-auto">
            <input type="hidden" name="messageId" value={message.id} />
            <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              {t("inbox.markRead")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

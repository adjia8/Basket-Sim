import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getInboxMessages } from "@/lib/data-access/inbox";
import { markMessageRead, markAllMessagesRead, openMessage, respondToPoachFromInbox } from "@/app/actions/inbox";
import { prisma } from "@/lib/prisma";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatGameDate, playerHref } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";
import type { InboxMessageView } from "@/lib/data-access/inbox";

// Couleur de la pastille de type (repère visuel façon Football Manager).
const TYPE_TONE: Record<string, string> = {
  injury: "bg-bad/15 text-bad",
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
    case "award":
      return message.playerId
        ? [{ label: t("inbox.action.viewPlayer"), href: playerHref(message.playerId, teamId), primary: true }]
        : [];
    case "staff":
      return [{ label: t("inbox.action.staffPage"), href: "/staff", primary: true }];
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

export default async function InboxPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [{ unread, read }, pendingTradeOffers, gmProfile] = await Promise.all([
    getInboxMessages(membership.careerId, membership.teamId),
    prisma.tradeOffer.count({
      where: { careerId: membership.careerId, toTeamId: membership.teamId, status: "pending" },
    }),
    prisma.gmProfile.findUnique({ where: { membershipId: membership.id }, select: { pendingOfferTeamId: true } }),
  ]);
  const hasPendingPoachOffer = Boolean(gmProfile?.pendingOfferTeamId);

  const card = (message: InboxMessageView, isUnread: boolean) => (
    <MessageCard
      key={message.id}
      message={message}
      isUnread={isUnread}
      locale={locale}
      t={t}
      actions={actionsFor(message, membership.teamId, t)}
      poachDecision={message.type === "poach_offer" && hasPendingPoachOffer}
    />
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("inbox.title")}</h1>
        {unread.length > 0 && (
          <form action={markAllMessagesRead}>
            <button
              type="submit"
              className="rounded-md bg-surface-2 px-3 py-1.5 text-sm transition hover:bg-surface-3"
            >
              {t("inbox.markAllRead")}
            </button>
          </form>
        )}
      </div>

      {pendingTradeOffers > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <p className="text-sm font-medium">{t("inbox.pendingTradeOffers", { count: pendingTradeOffers })}</p>
          <Link
            href="/trades"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
          >
            {t("inbox.action.viewTrades")}
          </Link>
        </div>
      )}

      <section className="mt-6">
        <h2 className="eyebrow mb-3">
          {t("inbox.unreadHeading")} · {unread.length}
        </h2>
        {unread.length === 0 ? (
          <p className="text-sm text-muted">{t("inbox.noUnread")}</p>
        ) : (
          <div className="space-y-3">{unread.map((m) => card(m, true))}</div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">{t("inbox.readHeading")}</h2>
        {read.length === 0 ? (
          <p className="text-sm text-muted">{t("inbox.noRead")}</p>
        ) : (
          <div className="space-y-2">{read.map((m) => card(m, false))}</div>
        )}
      </section>
    </div>
  );
}

function MessageCard({
  message,
  isUnread,
  locale,
  t,
  actions,
  poachDecision,
}: {
  message: InboxMessageView;
  isUnread: boolean;
  locale: Locale;
  t: Translator;
  actions: MessageAction[];
  poachDecision: boolean;
}) {
  const typeLabel = ["press", "injury", "trade_request", "free_agent", "free_agency", "standings", "poach_offer", "press_review", "player_reaction", "fine", "staff", "trade_offer", "award"].includes(message.type)
    ? t(`inbox.type.${message.type}` as "inbox.type.press")
    : message.type;
  return (
    <div
      className={`card relative overflow-hidden p-4 ${isUnread ? "" : "opacity-75"}`}
    >
      {isUnread && <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${TYPE_TONE[message.type] ?? "bg-surface-3 text-soft"}`}>
          {typeLabel}
        </span>
        <span className="text-faint">
          {message.gameDate ? formatGameDate(message.gameDate, locale) : t("inbox.offseason")}
        </span>
      </div>
      <p className={`mt-2 ${isUnread ? "font-semibold" : "font-medium"}`}>{message.title}</p>
      <p className="mt-1 text-sm text-soft">{message.body}</p>

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

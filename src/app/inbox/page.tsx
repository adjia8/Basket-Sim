import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getInboxMessages } from "@/lib/data-access/inbox";
import { markMessageRead, markAllMessagesRead } from "@/app/actions/inbox";
import { getTranslator } from "@/lib/i18n/translate";
import { formatGameDate } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";
import type { InboxMessageView } from "@/lib/data-access/inbox";

export default async function InboxPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const { unread, read } = await getInboxMessages(membership.careerId, membership.teamId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("inbox.title")}</h1>
        {unread.length > 0 && (
          <form action={markAllMessagesRead}>
            <button
              type="submit"
              className="rounded-full bg-black/5 px-3 py-1 text-sm transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {t("inbox.markAllRead")}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("inbox.unreadHeading")}
        </h2>
        {unread.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("inbox.noUnread")}</p>
        ) : (
          <div className="space-y-3">
            {unread.map((message) => (
              <MessageCard key={message.id} message={message} locale={locale} viewLabel={t("inbox.viewLink")}>
                <form action={markMessageRead}>
                  <input type="hidden" name="messageId" value={message.id} />
                  <button
                    type="submit"
                    className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                  >
                    {t("inbox.markRead")}
                  </button>
                </form>
              </MessageCard>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("inbox.readHeading")}
        </h2>
        {read.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("inbox.noRead")}</p>
        ) : (
          <div className="space-y-3">
            {read.map((message) => (
              <MessageCard key={message.id} message={message} locale={locale} viewLabel={t("inbox.viewLink")} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageCard({
  message,
  locale,
  viewLabel,
  children,
}: {
  message: InboxMessageView;
  locale: Locale;
  viewLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-black/40 dark:text-white/40">{formatGameDate(message.createdAt, locale)}</p>
          <p className="mt-1 font-medium">{message.title}</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">{message.body}</p>
        </div>
        {children}
      </div>
      {message.linkHref && (
        <Link href={message.linkHref} className="mt-2 inline-block text-sm underline underline-offset-2">
          {viewLabel}
        </Link>
      )}
    </div>
  );
}

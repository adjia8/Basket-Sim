import type { TradeDeadlineInfo } from "@/lib/data-access/season-windows";
import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { formatLongDate } from "@/lib/utils";

// Annonce la date limite des échanges tant qu'elle n'est pas passée (NBA :
// date fixe, voir getTradeDeadlineInfo) — rien en WNBA (pas de date fixe)
// ni une fois la date dépassée (chaque page affiche alors son propre
// message de fermeture).
export function TradeDeadlineNotice({
  info,
  t,
  locale,
  className = "",
}: {
  info: TradeDeadlineInfo;
  t: Translator;
  locale: Locale;
  className?: string;
}) {
  if (!info.deadline || info.passed || info.daysLeft === null) return null;
  const date = formatLongDate(info.deadline, locale);
  return (
    <p className={`text-sm ${info.daysLeft <= 7 ? "text-warn" : "text-soft"} ${className}`}>
      {info.daysLeft === 0
        ? t("common.tradeDeadline.today", { date })
        : t("common.tradeDeadline.upcoming", { date, days: info.daysLeft })}
    </p>
  );
}

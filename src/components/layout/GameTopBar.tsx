import Link from "next/link";
import { getOptionalCurrentMembership } from "@/lib/auth/dal";
import { getGameClock } from "@/lib/data-access/game-clock";
import { getTeamById } from "@/lib/data-access/teams";
import { getTranslator } from "@/lib/i18n/translate";
import { formatGameDate, formatLongDate, teamFullName } from "@/lib/utils";
import { ContinueButton } from "./ContinueButton";

// Barre du haut façon Football Manager, sur toutes les pages d'une Career :
// date du jeu, prochain match, et le bouton « Continuer » toujours au même
// endroit (voir ContinueButton.tsx / continueGame).
export async function GameTopBar() {
  const membership = await getOptionalCurrentMembership();
  if (!membership) return null;
  const { t, locale } = await getTranslator();

  const clock = await getGameClock(membership.careerId, membership.teamId);
  const opponent = clock.nextGame ? await getTeamById(clock.nextGame.opponentTeamId) : null;
  const next = clock.nextGame;

  return (
    <div className="sticky top-[61px] z-20 border-b border-line bg-surface/95 backdrop-blur lg:top-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0">
            <p className="eyebrow">{next ? t(`common.topbar.phase.${next.phase}`) : " "}</p>
            <p className="text-sm font-semibold first-letter:uppercase">
              {clock.today ? formatLongDate(clock.today, locale) : "—"}
            </p>
          </div>
          <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />
          <div className="hidden min-w-0 sm:block">
            <p className={`eyebrow ${clock.isMatchDay ? "text-accent-text" : ""}`}>
              {clock.isMatchDay ? t("common.topbar.matchDay") : t("common.topbar.nextGame")}
            </p>
            {next && opponent ? (
              <Link href={`/game/${next.id}`} className="block truncate text-sm font-medium hover:underline">
                {next.isHome ? "vs" : "@"} {teamFullName(opponent)}
                <span className="text-muted">
                  {" · "}
                  {formatGameDate(next.date.toISOString(), locale)}
                  {" · "}
                  {clock.daysUntilNextGame === 0
                    ? t("common.topbar.today")
                    : t("common.topbar.inDays", { days: clock.daysUntilNextGame ?? 0 })}
                </span>
              </Link>
            ) : (
              <p className="text-sm text-muted">{t("common.topbar.noGame")}</p>
            )}
          </div>
        </div>
        <ContinueButton
          isMatchDay={clock.isMatchDay}
          nextGameId={next?.id ?? null}
          labels={{
            continue: t("common.topbar.continue"),
            playGame: t("common.topbar.playGame"),
            progress: t("common.topbar.progress"),
            playing: t("common.topbar.playing"),
            waitingFor: t("common.topbar.waitingFor"),
            newMessages: t("common.topbar.newMessages"),
            draftTurn: t("common.topbar.draftTurn"),
            error: t("common.topbar.error"),
          }}
        />
      </div>
    </div>
  );
}

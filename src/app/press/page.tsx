import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession, flattenMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import {
  getPendingPressConference,
  getPressHistory,
  getSquadMorale,
  type PressConferenceView,
  type PressOutcome,
} from "@/lib/data-access/press";
import { submitPressAnswers, skipPressAnswers } from "@/app/actions/press";
import { PressSubmitButtons } from "@/components/press/PressSubmitButtons";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { toneClass, neutralTone } from "@/lib/color-scale";
import { formatGameDate, playerHref } from "@/lib/utils";
import { moraleLevel, MORALE_TRADE_REQUEST_THRESHOLD } from "@/lib/careers/morale-rules";

const TONE_STYLE: Record<string, string> = {
  calm: "bg-info/15 text-info",
  diplomatic: "bg-info/15 text-info",
  assertive: "bg-accent/15 text-accent-text",
  confident: "bg-accent/15 text-accent-text",
  aggressive: "bg-bad/15 text-bad",
  critical: "bg-bad/15 text-bad",
  passionate: "bg-warn/15 text-warn",
  reserved: "bg-surface-3 text-soft",
  humble: "bg-surface-3 text-soft",
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function topicLabel(t: Translator, topic: string | null, category: string): string {
  if (topic) return t(`pressPage.topic.${topic}` as DictionaryKey);
  const categoryKey: Record<string, DictionaryKey> = {
    results: "pressPage.categoryResults",
    roster: "pressPage.categoryRoster",
    management: "pressPage.categoryManagement",
    future: "pressPage.categoryFuture",
  };
  return categoryKey[category] ? t(categoryKey[category]) : category;
}

function Meter({ value }: { value: number }) {
  const tone = value >= 65 ? "bg-good" : value >= 45 ? "bg-warn" : "bg-bad";
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <span className={`block h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(99, value))}%` }} />
    </span>
  );
}

// Pastilles d'effets d'une réponse (moral, opinion, direction, joueur visé…).
function OutcomeChips({ outcome, t }: { outcome: PressOutcome; t: Translator }) {
  const chips: { label: string; value?: number; bad?: boolean }[] = [];
  if (outcome.morale) chips.push({ label: t("pressPage.effect.morale"), value: outcome.morale });
  if (outcome.publicOpinion) chips.push({ label: t("pressPage.effect.publicOpinion"), value: outcome.publicOpinion });
  if (outcome.frontOfficeApproval) chips.push({ label: t("pressPage.effect.frontOffice"), value: outcome.frontOfficeApproval });
  if (outcome.playerMorale && outcome.playerName) chips.push({ label: outcome.playerName, value: outcome.playerMorale });
  if (outcome.squadMorale) chips.push({ label: t("pressPage.effect.squad"), value: outcome.squadMorale });
  if (outcome.refereeCriticism) chips.push({ label: t("pressPage.effect.referee"), bad: true });
  if (chips.length === 0) return <span className="text-xs text-faint">{t("pressPage.effect.none")}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const positive = c.value !== undefined && c.value > 0;
        const tone = c.bad || (c.value !== undefined && c.value < 0) ? "bg-bad/15 text-bad" : positive ? "bg-good/15 text-good" : "bg-surface-3 text-soft";
        return (
          <span key={c.label} className={`rounded px-1.5 py-0.5 text-[11px] font-medium tabular ${tone}`}>
            {c.label}
            {c.value !== undefined ? ` ${c.value > 0 ? "+" : ""}${c.value}` : ""}
          </span>
        );
      })}
    </span>
  );
}

function ConferenceResult({ conference, t, locale }: { conference: PressConferenceView; t: Translator; locale: Locale }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
        <span className="tabular">{formatGameDate(conference.gameDate, locale)}</span>
        {conference.kind === "playoffs" && (
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent-text">{t("pressPage.playoffs")}</span>
        )}
        {conference.skipped && <span className="rounded bg-surface-3 px-1.5 py-0.5 text-soft">{t("pressPage.skipped")}</span>}
      </div>
      {conference.headline && (
        <p className="border-l-2 border-accent pl-3 font-serif text-lg font-semibold leading-snug">{conference.headline}</p>
      )}
      {!conference.skipped && (
        <ul className="space-y-3">
          {conference.questions.map((q) => {
            const chosen = q.options.find((o) => o.id === q.chosenOptionId);
            return (
              <li key={q.id} className="text-sm">
                <p className="text-soft">
                  {q.journalist && <span className="font-medium text-fg">{q.journalist} : </span>}
                  {q.prompt}
                </p>
                {chosen && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE_STYLE[chosen.tone] ?? ""}`}>
                      {t(`pressPage.tone.${chosen.tone}` as DictionaryKey)}
                    </span>
                    <span className="font-medium">{chosen.label}</span>
                  </div>
                )}
                {q.outcome && (
                  <div className="mt-1.5">
                    <OutcomeChips outcome={q.outcome} t={t} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Ne passe volontairement pas par getCurrentMembership() : celle-ci redirige
// déjà ici dès qu'une conférence de presse est en attente (obligatoire avant
// d'accéder au reste de l'app), ce qui créerait une boucle de redirection si
// cette page l'appelait aussi — même principe que /onboarding/reassign pour
// pendingReassignment.
export default async function PressPage() {
  const { userId } = await verifySession();
  const membershipRow = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true, gmProfile: { select: { pendingReassignment: true } } },
  });
  if (!membershipRow) redirect("/onboarding");
  if (membershipRow.gmProfile?.pendingReassignment) redirect("/onboarding/reassign");
  const membership = flattenMembership(membershipRow);
  const { t, locale } = await getTranslator();

  const [teamState, gmProfile, pending, history, squad] = await Promise.all([
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
    prisma.gmProfile.findUnique({ where: { membershipId: membership.id }, select: { frontOfficeApproval: true } }),
    getPendingPressConference(membership.careerId, membership.teamId),
    getPressHistory(membership.careerId, membership.teamId),
    getSquadMorale(membership.careerId, membership.teamId),
  ]);
  const [latest, ...older] = history;

  const stats = [
    { label: t("pressPage.morale"), value: teamState.morale },
    { label: t("pressPage.publicOpinion"), value: teamState.publicOpinion },
    ...(gmProfile ? [{ label: t("pressPage.frontOfficeApproval"), value: gmProfile.frontOfficeApproval }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("pressPage.title")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t("pressPage.subtitle")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="eyebrow">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular ${toneClass(neutralTone(s.value))}`}>
              {s.value}
              <span className="text-sm font-normal text-faint"> / 99</span>
            </p>
            <div className="mt-2">
              <Meter value={s.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-4 sm:p-5">
            <h2 className="eyebrow mb-4">{t("pressPage.pendingHeading")}</h2>
            {!pending ? (
              <>
                <p className="text-sm">{t("pressPage.noPending")}</p>
                <p className="mt-1 text-xs text-muted">{t("pressPage.noPendingHint")}</p>
              </>
            ) : (
              <form action={submitPressAnswers} className="space-y-6">
                <input type="hidden" name="conferenceId" value={pending.id} />
                {pending.kind === "playoffs" && (
                  <span className="inline-block rounded bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-text">
                    {t("pressPage.playoffs")}
                  </span>
                )}
                {pending.questions.map((question, i) => (
                  <fieldset key={question.id} className="space-y-2">
                    <legend className="sr-only">{question.prompt}</legend>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-soft">
                        {initials(question.journalist)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {question.journalist ?? "—"}
                          {question.outlet && <span className="font-normal text-muted"> · {question.outlet}</span>}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-faint">
                          {topicLabel(t, question.topic, question.category)}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium leading-snug">
                      <span className="text-faint">{i + 1}. </span>
                      {question.prompt}
                    </p>
                    <div className="grid gap-2">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                        >
                          <input
                            type="radio"
                            name={`answer_${question.id}`}
                            value={option.id}
                            required
                            className="mt-1 accent-[var(--accent)]"
                          />
                          <span className="flex-1">{option.label}</span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE_STYLE[option.tone] ?? "bg-surface-3 text-soft"}`}
                          >
                            {t(`pressPage.tone.${option.tone}` as DictionaryKey)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <PressSubmitButtons
                  skipAction={skipPressAnswers}
                  labels={{
                    answer: t("pressPage.answer"),
                    skip: t("pressPage.skip"),
                    sending: t("pressPage.sending"),
                    skipHint: t("pressPage.skipHint"),
                  }}
                />
              </form>
            )}
          </section>

          {latest && (
            <section className="card p-4 sm:p-5">
              <h2 className="eyebrow mb-4">{t("pressPage.latestHeading")}</h2>
              <ConferenceResult conference={latest} t={t} locale={locale} />
            </section>
          )}

          <section className="card p-4 sm:p-5">
            <h2 className="eyebrow mb-3">{t("pressPage.historyHeading")}</h2>
            {older.length === 0 ? (
              <p className="text-sm text-muted">{t("pressPage.noHistory")}</p>
            ) : (
              <div className="divide-y divide-line-soft">
                {older.map((conference) => (
                  <details key={conference.id} className="group py-2.5">
                    <summary className="flex cursor-pointer list-none items-baseline gap-3 text-sm">
                      <span className="w-20 shrink-0 text-xs text-faint tabular">
                        {formatGameDate(conference.gameDate, locale)}
                      </span>
                      <span className="flex-1 font-medium group-open:text-accent-text">
                        {conference.headline ??
                          conference.questions.map((q) => topicLabel(t, q.topic, q.category)).join(" · ")}
                      </span>
                      <span className="text-faint transition group-open:rotate-90">›</span>
                    </summary>
                    <div className="mt-3 pl-0 sm:pl-23">
                      <ConferenceResult conference={{ ...conference, headline: null }} t={t} locale={locale} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-4">
            <h2 className="eyebrow mb-1">{t("pressPage.squadHeading")}</h2>
            <p className="mb-3 text-xs text-muted">{t("pressPage.squadHint")}</p>
            <ul className="space-y-2.5">
              {squad.map((p) => {
                const level = moraleLevel(p.morale);
                const alarm = p.wantsTrade || p.morale <= MORALE_TRADE_REQUEST_THRESHOLD;
                return (
                  <li key={p.playerId} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={playerHref(p.playerId, membership.teamId)} className="truncate font-medium hover:underline">
                        {p.name}
                      </Link>
                      <span
                        className={`shrink-0 text-xs ${level === "superb" || level === "good" ? "text-good" : level === "okay" ? "text-muted" : "text-bad"}`}
                      >
                        {t(`pressPage.moraleLevel.${level}` as DictionaryKey)}
                        <span className="ml-1 text-faint tabular">{p.morale}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <Meter value={p.morale} />
                    </div>
                    {alarm && p.wantsTrade && <p className="mt-0.5 text-[11px] text-bad">⚠ {t("pressPage.wantsTrade")}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-4 text-sm">
            <p className={teamState.refereeCriticisms >= 2 ? "text-bad" : ""}>
              {t("pressPage.refereeCriticisms", { count: teamState.refereeCriticisms })}
            </p>
            <p className="mt-1 text-xs text-muted">{t("pressPage.refereeHint")}</p>
            <h2 className="eyebrow mb-1 mt-4">{t("pressPage.attitudesHeading")}</h2>
            <p className="text-xs leading-relaxed text-muted">{t("pressPage.attitudesHint")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

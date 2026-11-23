import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getProspectsForCareer } from "@/lib/data-access/prospects";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getCurrentDraftPick } from "@/lib/data-access/draft-picks";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getTeamById, getTeamsByLeague } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { draftForAiTeam, draftProspect } from "@/app/actions/draft";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";
import { ensureCareerStaff, getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { estimateError, estimateRating, ratingStars } from "@/lib/careers/potential-rules";
import { Stars } from "@/components/ui/Stars";
import { DraftInterviewForm } from "@/components/draft/DraftInterviewForm";
import { MyDraftPicks } from "@/components/draft/MyDraftPicks";
import { MyEuropeRights } from "@/components/europe/MyEuropeRights";
import { europeanClubOf } from "@/lib/careers/europe-rules";
import {
  INTERVIEWS_PER_DRAFT,
  INTERVIEW_QUESTIONS,
  QUESTIONS_PER_INTERVIEW,
  QUESTION_TRAIT,
  type InterviewAnswer,
} from "@/lib/careers/draft-interview-rules";

export default async function DraftPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [prospects, teams, league] = await Promise.all([
    getProspectsForCareer(membership.careerId),
    getTeamsByLeague(membership.leagueId),
    getLeagueById(membership.leagueId),
  ]);
  const picksPerRound = teams.length;
  const salaryCap = league?.salaryCap ?? Infinity;

  const currentPick = await getCurrentDraftPick(
    membership.careerId,
    membership.season,
    salaryCap,
    picksPerRound,
    membership.leagueId
  );

  if (!currentPick) {
    const hasDraftPicks = await prisma.draftPick.count({
      where: { careerId: membership.careerId, season: membership.season },
    });
    return (
      <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("draft.title")}</h1>
        {membership.leagueId === "nba" && (
          <Link href="/draft/future" className="mt-1 inline-block text-sm text-accent-text hover:underline">
            {t("futureDraft.link")}
          </Link>
        )}
        <p className="mt-4 text-sm text-muted">
          {hasDraftPicks > 0 ? t("draft.overForSeason") : t("draft.noneInProgress")}
        </p>
        <MyDraftPicks careerId={membership.careerId} teamId={membership.teamId} season={membership.season} t={t} />
      <MyEuropeRights careerId={membership.careerId} teamId={membership.teamId} t={t} locale={locale} />
      </div>
    );
  }

  const [pickTeam, manager] = await Promise.all([
    getTeamById(currentPick.teamId),
    getMembershipForTeam(membership.careerId, currentPick.teamId),
  ]);

  const isMyTurn = currentPick.teamId === membership.teamId;

  // Brouillard du recrutement (voir potential-rules.ts) : le GM ne voit que
  // les estimations de ses recruteurs, triées sur l'estimation (trier sur la
  // vraie note la trahirait).
  await ensureCareerStaff(membership.careerId, membership.leagueId, membership.season);
  const scouting = ((await getStaffProfiles(membership.careerId, [membership.teamId], membership.leagueId)).get(membership.teamId) ?? NEUTRAL_STAFF_PROFILE).scouting;
  const scouted = prospects
    .map((p) => ({
      prospect: p,
      current: estimateRating(p.overallRating, scouting, `${membership.careerId}:${membership.teamId}:${p.id}:cur`, 0.6),
      potential: estimateRating(p.potential || p.overallRating, scouting, `${membership.careerId}:${membership.teamId}:${p.id}:pot`),
    }))
    .sort((a, b) => b.current.mid - a.current.mid);
  const pickTerms = rookieScaleContract(currentPick.pickNumber, picksPerRound, membership.leagueId);
  // Entretiens d'avant-draft (voir draft-interview-rules.ts).
  const interviews = await prisma.prospectInterview.findMany({
    where: { careerId: membership.careerId, teamId: membership.teamId, season: membership.season },
    orderBy: { createdAt: "asc" },
  });
  const interviewed = new Set(interviews.map((i) => i.prospectId));
  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  const interviewsLeft = Math.max(0, INTERVIEWS_PER_DRAFT - interviews.length);

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("draft.title")}</h1>
        {membership.leagueId === "nba" && (
          <Link href="/draft/future" className="mt-1 inline-block text-sm text-accent-text hover:underline">
            {t("futureDraft.link")}
          </Link>
        )}
      <p className="mt-1 text-soft">
        {t("draft.pickLinePrefix", { number: currentPick.pickNumber, round: currentPick.round })}{" "}
        {pickTeam ? (
          <Link href={`/teams/${pickTeam.id}`} className="hover:underline">
            {teamFullName(pickTeam)}
          </Link>
        ) : (
          "?"
        )}{" "}
        {t("draft.pickLineSuffix", { salary: formatSalary(pickTerms.salary, locale) })}{" "}
        {pickTerms.guaranteed ? t("draft.guaranteed") : t("draft.notGuaranteed")}
      </p>

      {isMyTurn ? (
        <p className="mt-3 text-sm font-medium">{t("draft.yourTurn")}</p>
      ) : manager ? (
        <p className="mt-3 text-sm text-muted">
          {t("draft.waitingForPrefix")} {manager.email}…
        </p>
      ) : (
        <form action={draftForAiTeam} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            {t("draft.draftForAi", { team: pickTeam ? teamFullName(pickTeam) : t("draft.aiFallback") })}
          </button>
        </form>
      )}

      {prospects.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          {t("draft.scoutingHint", { level: scouting, error: Math.round(estimateError(scouting) / 2) })}
        </p>
      )}

      <MyDraftPicks careerId={membership.careerId} teamId={membership.teamId} season={membership.season} t={t} />
      <MyEuropeRights careerId={membership.careerId} teamId={membership.teamId} t={t} locale={locale} />

      {prospects.length > 0 && (
        <section className="mt-6 card p-4" data-testid="draft-interviews">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("interview.title")}</h2>
          <p className="mt-1 text-xs text-faint">
            {t("interview.subtitle", { count: INTERVIEWS_PER_DRAFT, questions: QUESTIONS_PER_INTERVIEW })}
          </p>
          <p className="mt-2 text-sm font-medium">{t("interview.remaining", { count: interviewsLeft })}</p>
          {interviewsLeft > 0 && (
            <DraftInterviewForm
              prospects={scouted
                .filter((s) => !interviewed.has(s.prospect.id))
                .map((s) => ({
                  id: s.prospect.id,
                  label: `${s.prospect.firstName} ${s.prospect.lastName} · ${s.prospect.position} · ${s.current.low}-${s.current.high}`,
                }))}
              questions={INTERVIEW_QUESTIONS.map((q) => ({ value: q, label: t(`interview.q.${q}`) }))}
              labels={{
                prospect: t("interview.prospect"),
                questions: t("interview.questions"),
                submit: t("interview.submit"),
                sending: t("interview.sending"),
              }}
            />
          )}
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t("interview.done")}</h3>
          {interviews.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t("interview.none")}</p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {interviews.map((iv) => {
                const p = prospectById.get(iv.prospectId);
                const answers = JSON.parse(iv.answersJson) as InterviewAnswer[];
                return (
                  <li key={iv.id} className="rounded-md border border-line p-3">
                    <p className="font-medium">{p ? `${p.firstName} ${p.lastName}` : iv.prospectId}</p>
                    <ul className="mt-1 space-y-1">
                      {answers.map((a) => (
                        <li key={a.question}>
                          <span className="text-muted">{t(`interview.q.${a.question}`)} </span>
                          <span className="italic">{t(`interview.a.${a.question}.${a.band}`)}</span>{" "}
                          <span
                            className={`rounded px-1.5 py-0.5 text-2xs font-medium ${
                              a.band === "high" ? "bg-good/15 text-good" : a.band === "low" ? "bg-bad/15 text-bad" : "bg-surface-3 text-soft"
                            }`}
                          >
                            {t(`personality.trait.${QUESTION_TRAIT[a.question]}`)} : {t(`interview.band.${a.band}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {prospects.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("draft.noProspects")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="data-table w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">{t("draft.colProspect")}</th>
                <th className="py-2 pr-4">{t("draft.colPosition")}</th>
                <th className="py-2 pr-4">{t("draft.colOverall")}</th>
                <th className="py-2 pr-4">{t("draft.colPotential")}</th>
                <th className="py-2 pr-4">{t("draft.colAge")}</th>
                {isMyTurn && <th className="py-2">{t("draft.colAction")}</th>}
              </tr>
            </thead>
            <tbody>
              {scouted.map(({ prospect, current, potential }) => (
                <tr key={prospect.id} className="border-b border-line-soft">
                  <td className="py-2 pr-4 font-medium">
                    {prospect.firstName} {prospect.lastName}
                  </td>
                  <td className="py-2 pr-4">{prospect.position}</td>
                  <td className="py-2 pr-4 tabular">
                    <span className="font-semibold">{current.mid}</span>{" "}
                    <span className="text-xs text-faint">
                      ({current.low}-{current.high})
                    </span>
                  </td>
                  <td className="py-2 pr-4 tabular">
                    <Stars value={ratingStars(potential.mid)} />{" "}
                    <span className="text-xs text-faint">
                      {potential.low}-{potential.high}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{prospect.age}</td>
                  {isMyTurn && (
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <form action={draftProspect}>
                          <input type="hidden" name="prospectId" value={prospect.id} />
                          <button
                            type="submit"
                            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg transition hover:bg-accent-hover"
                          >
                            {t("draft.draftButton")}
                          </button>
                        </form>
                        {/* Prospect qui joue en Europe : peut y rester (draft-and-stash). */}
                        {europeanClubOf(prospect.scoutingNote) && (
                          <form action={draftProspect}>
                            <input type="hidden" name="prospectId" value={prospect.id} />
                            <input type="hidden" name="stash" value="1" />
                            <button
                              type="submit"
                              title={t("europe.stashHint")}
                              className="whitespace-nowrap rounded-md border border-info/60 px-3 py-1 text-xs font-medium text-info transition hover:bg-info/10"
                              data-testid="draft-stash"
                            >
                              {t("europe.stash")}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

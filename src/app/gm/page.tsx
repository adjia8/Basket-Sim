import { notFound } from "next/navigation";
import { InfoTip } from "@/components/ui/InfoTip";
import { getBoardObjectivesProgress } from "@/lib/data-access/board-objectives";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamsByLeague, getTeamById } from "@/lib/data-access/teams";
import { acceptPoachOffer, declinePoachOffer, respondToExtension } from "@/app/actions/gm";
import { ensureGmContract, getGmCareerView } from "@/lib/data-access/gm-career";
import { GM_ATTRIBUTE_MAX, GM_ATTRIBUTES, interestedTeams, lifestyleLevel } from "@/lib/careers/gm-career-rules";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { ExpectationTier } from "@/lib/careers/gm-rules";
import { healthyFinancesThreshold } from "@/lib/careers/finance-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";
import { financeTone, ratingTone, neutralTone, toneClass, type ScaleTone } from "@/lib/color-scale";

const OUTCOME_TONES: Record<string, ScaleTone> = {
  met: "good",
  exceeded: "good",
  poached: "good",
  warning: "average",
  fired: "bad",
};

function expectationLabels(t: Translator): Record<ExpectationTier, string> {
  return {
    rebuild: t("domain.expectationTier.rebuild"),
    play_in: t("domain.expectationTier.play_in"),
    playoffs: t("domain.expectationTier.playoffs"),
    conf_semis: t("domain.expectationTier.conf_semis"),
    conf_finals: t("domain.expectationTier.conf_finals"),
    nba_finals: t("domain.expectationTier.nba_finals"),
    champion: t("domain.expectationTier.champion"),
  };
}

function outcomeLabels(t: Translator): Record<string, string> {
  return {
    met: t("gm.outcomeMet"),
    exceeded: t("gm.outcomeExceeded"),
    warning: t("gm.outcomeWarning"),
    fired: t("gm.outcomeFired"),
    poached: t("gm.outcomePoached"),
  };
}

function sexLabels(t: Translator): Record<string, string> {
  return { M: t("gm.sexMale"), F: t("gm.sexFemale"), autre: t("gm.sexOther") };
}

export default async function GmPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const membershipRow = await prisma.membership.findUnique({
    where: { id: membership.id },
    include: { gmProfile: { include: { seasonRecords: { orderBy: { createdAt: "desc" } } } } },
  });
  const gm = membershipRow?.gmProfile;
  if (!gm) notFound();

  const [teamState, standings, leagueTeams] = await Promise.all([
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getTeamsByLeague(membership.leagueId),
  ]);
  const teamNameById = new Map(leagueTeams.map((t) => [t.id, teamFullName(t)]));
  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);

  const offerTeam = gm.pendingOfferTeamId ? await getTeamById(gm.pendingOfferTeamId) : null;
  // Carrière du GM (voir gm-career-rules.ts) : contrat, note, réputation, fortune.
  const contract = await ensureGmContract(gm, membership.leagueId, membership.teamId);
  const career = await getGmCareerView(membership.careerId, membership.teamId, gm, standings);
  const interestedCount = interestedTeams(
    leagueTeams.filter((x) => x.id !== membership.teamId),
    gm.reputation,
    0
  ).length;
  const parseTerms = (json: string | null) => {
    try {
      return json ? (JSON.parse(json) as { salary: number; years: number }) : null;
    } catch {
      return null;
    }
  };
  const offerTerms = parseTerms(gm.pendingOfferJson);
  const extension = parseTerms(gm.pendingExtensionJson);
  const lastChanges = (() => {
    try {
      return gm.lastSeasonChangesJson
        ? (JSON.parse(gm.lastSeasonChangesJson) as { season: string; reputationBefore: number; reputation: number; severance?: number })
        : null;
    } catch {
      return null;
    }
  })();
  const repLevel = gm.reputation >= 75 ? "star" : gm.reputation >= 55 ? "recognized" : gm.reputation >= 30 ? "respected" : "unknown";
  const money = (v: number) => formatSalary(v, locale);
  // Objectifs des propriétaires de la saison (voir board-objectives.ts).
  const board = await getBoardObjectivesProgress(
    membership.careerId,
    membership.leagueId,
    membership.season,
    membership.teamId,
    gm.boardObjectivesJson
  );
  const fmtObjective = (type: string, v: number) => (type === "attendance" ? `${Math.round(v)}/99` : `${Math.round(v * 100)} %`);

  const expectationLabel = expectationLabels(t);
  const outcomeLabel = outcomeLabels(t);
  const sexLabel = sexLabels(t);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("gm.pageTitle")}</h1>

      {offerTeam && (
        <div className="mt-6 rounded-xl border border-info/30 bg-info/5 p-4">
          <p className="font-medium">
            {t("gm.poachOfferPrefix")}{" "}
            <Link href={`/teams/${offerTeam.id}`} className="hover:underline">
              {teamFullName(offerTeam)}
            </Link>{" "}
            {t("gm.poachOfferSuffix")}
          </p>
          {offerTerms && (
            <p className="mt-1 text-sm text-soft" data-testid="offer-terms">
              {t("gmCareer.offerTerms", { salary: money(offerTerms.salary), years: offerTerms.years })}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <form action={acceptPoachOffer}>
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
              >
                {t("gm.accept")}
              </button>
            </form>
            <form action={declinePoachOffer}>
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface-2"
              >
                {t("gm.decline")}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6 card p-4" data-testid="board-objectives">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("board.title")}
          <InfoTip text={t("help.boardObjectives")} />
        </h2>
        {!board ? (
          <p className="text-sm text-muted">{t("board.empty")}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {board.objectives.map((o) => (
              <li key={o.type}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="first-letter:uppercase">{board.describe(o, locale)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      o.status === "met"
                        ? "bg-good/15 text-good"
                        : o.status === "failed"
                          ? "bg-bad/15 text-bad"
                          : o.actual >= o.target
                            ? "bg-good/10 text-good"
                            : "bg-warn/15 text-warn"
                    }`}
                  >
                    {t(`board.status.${o.status}`)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${o.actual >= o.target ? "bg-good" : "bg-warn"}`}
                    style={{ width: `${Math.min(100, (o.actual / o.target) * 100)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted">{t("board.actual", { value: fmtObjective(o.type, o.actual) })}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("gm.identity")}
        </h2>
        <p className="text-lg font-semibold">
          {gm.firstName} {gm.lastName}
        </p>
        <p className="text-sm text-muted">
          {t("player.ageLabel", { age: gm.age })} · {sexLabel[gm.sex] ?? gm.sex}
        </p>
      </div>

      {extension && (
        <div className="mt-6 rounded-xl border border-good/40 bg-good/5 p-4" data-testid="gm-extension">
          <p className="font-medium">{t("gmCareer.extensionTitle")}</p>
          <p className="mt-1 text-sm text-soft">{t("gmCareer.extensionTerms", { salary: money(extension.salary), years: extension.years })}</p>
          <div className="mt-3 flex gap-2">
            <form action={respondToExtension}>
              <input type="hidden" name="decision" value="accept" />
              <button type="submit" className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
                {t("gmCareer.sign")}
              </button>
            </form>
            <form action={respondToExtension}>
              <input type="hidden" name="decision" value="decline" />
              <button type="submit" className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface-2">
                {t("gmCareer.decline")}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card p-4" data-testid="gm-rating">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("gmCareer.ratingTitle")}</h2>
            <span className={`text-3xl font-bold tabular ${toneClass(neutralTone(career.rating))}`}>{career.rating}</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {GM_ATTRIBUTES.map((a) => {
              const delta = career.projection[a];
              return (
                <li key={a}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{t(`gmCareer.attr.${a}` as DictionaryKey)}</span>
                    <span className="tabular">
                      {career.points[a]}
                      <span className="text-faint">/{GM_ATTRIBUTE_MAX}</span>
                      <span
                        className={`ml-2 inline-block w-6 text-right text-xs font-semibold ${delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-faint"}`}
                        data-testid={`gm-trend-${a}`}
                      >
                        {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "="}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(career.points[a] / GM_ATTRIBUTE_MAX) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-faint">{t("gmCareer.ratingHint")}</p>
          {lastChanges && (
            <p className="mt-1 text-xs text-muted">
              {t("gmCareer.lastSeason", { season: lastChanges.season, before: lastChanges.reputationBefore, after: lastChanges.reputation })}
            </p>
          )}
        </section>

        <section className="card p-4" data-testid="gm-reputation">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("gmCareer.reputationTitle")}</h2>
            <span className="text-right">
              <span className={`text-3xl font-bold tabular ${toneClass(neutralTone(gm.reputation))}`}>{gm.reputation}</span>
              <span className="ml-1 text-xs text-muted">{t(`gmCareer.repLevel.${repLevel}` as DictionaryKey)}</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t("gmCareer.clubImage")} : <span className={`font-semibold ${toneClass(neutralTone(career.standing))}`}>{career.standing}/99</span>
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {(["board", "players", "press", "fans"] as const).map((k) => (
              <li key={k}>
                <div className="flex justify-between gap-2">
                  <span>{t(`gmCareer.part.${k}` as DictionaryKey)}</span>
                  <span className={`tabular ${toneClass(neutralTone(career.parts[k]))}`}>{career.parts[k]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${career.parts[k] >= 60 ? "bg-good" : career.parts[k] >= 40 ? "bg-warn" : "bg-bad"}`}
                    style={{ width: `${career.parts[k]}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-soft">{t("gmCareer.interested", { count: interestedCount })}</p>
          <p className="mt-1 text-xs text-faint">{t("gmCareer.reputationHint")}</p>
        </section>
      </div>

      <section className="mt-6 card p-4" data-testid="gm-wealth">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("gmCareer.wealthTitle")}</h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{t("gmCareer.cash")}</p>
            <p className="text-2xl font-semibold tabular text-good">{money(gm.personalCash)}</p>
            <p className="mt-1 text-xs text-muted">
              {t("gmCareer.lifestyleLevel", {
                level: t(`gmCareer.lifestyle.${lifestyleLevel(career.prestige)}` as DictionaryKey),
                prestige: career.prestige,
              })}
            </p>
          </div>
          <Link href="/gm/lifestyle" className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
            {t("gmCareer.shopLink")}
          </Link>
        </div>
        <p className="mt-2 text-xs text-faint">{t("gmCareer.salaryPaid")}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("gm.treasury")}</p>
          <p
            className={`mt-1 text-xl font-semibold ${toneClass(
              financeTone(teamState.finances, healthyFinancesThreshold(membership.leagueId))
            )}`}
          >
            {formatSalary(teamState.finances, locale)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("gm.facilities")}</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.facilitiesLevel))}`}>
            {teamState.facilitiesLevel} / 99
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("gm.trainingStaff")}</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(ratingTone(teamState.trainingStaffLevel))}`}>
            {teamState.trainingStaffLevel} / 99
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">
            {t("gm.frontOfficeApproval")}
          </p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(neutralTone(gm.frontOfficeApproval))}`}>
            {gm.frontOfficeApproval} / 99
          </p>
        </div>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("gm.currentSeasonRecord")}
        </h2>
        <p className="text-lg font-semibold">
          {myStandingsRow ? `${myStandingsRow.wins}-${myStandingsRow.losses}` : "0-0"}
        </p>
        <p className="text-sm text-muted">
          {t("gm.objectivePrefix")} {expectationLabel[gm.currentExpectationTier as ExpectationTier]}
        </p>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("gm.contract")}
        </h2>
        <p className="text-sm" data-testid="gm-contract">
          <strong>{t("gmCareer.salary", { salary: money(contract.salary) })}</strong> · {t("gmCareer.years", { n: contract.years })}
        </p>
        <p className="mt-1 text-sm">
          {t("gm.hiredSincePrefix")} <strong>{gm.hiredSeason}</strong>
          {t("gm.hiredSinceSuffix")}
        </p>
        {lastChanges?.severance ? (
          <p className="mt-1 text-sm text-muted">{t("gmCareer.severance", { amount: money(lastChanges.severance) })}</p>
        ) : null}
        <p className="mt-1 text-sm">
          {gm.warningsAtCurrentTeam > 0 ? (
            <span className={toneClass("bad")}>
              {t(gm.warningsAtCurrentTeam > 1 ? "gm.warningMany" : "gm.warningOne", {
                count: gm.warningsAtCurrentTeam,
              })}
            </span>
          ) : (
            <span className={toneClass("good")}>{t("gm.noWarning")}</span>
          )}
        </p>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("gm.careerRecord")}
        </h2>
        {gm.seasonRecords.length === 0 ? (
          <p className="text-sm text-muted">{t("gm.noSeasonCompleted")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4">{t("gm.colSeason")}</th>
                  <th className="py-2 pr-4">{t("gm.colTeam")}</th>
                  <th className="py-2 pr-4">{t("gm.colRecord")}</th>
                  <th className="py-2 pr-4">{t("gm.colObjective")}</th>
                  <th className="py-2 pr-4">{t("gm.colResult")}</th>
                  <th className="py-2">{t("gm.colOutcome")}</th>
                </tr>
              </thead>
              <tbody>
                {gm.seasonRecords.map((record) => (
                  <tr key={record.id} className="border-b border-line-soft">
                    <td className="py-2 pr-4">{record.season}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/teams/${record.teamId}`} className="hover:underline">
                        {teamNameById.get(record.teamId) ?? record.teamId}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      {record.wins}-{record.losses}
                    </td>
                    <td className="py-2 pr-4">{expectationLabel[record.expectationTier as ExpectationTier]}</td>
                    <td className="py-2 pr-4">{expectationLabel[record.resultTier as ExpectationTier]}</td>
                    <td className={`py-2 font-medium ${toneClass(OUTCOME_TONES[record.outcome] ?? "average")}`}>
                      {outcomeLabel[record.outcome] ?? record.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

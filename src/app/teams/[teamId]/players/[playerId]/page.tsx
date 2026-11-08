import { notFound } from "next/navigation";
import { moraleLevel } from "@/lib/careers/morale-rules";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getContractForPlayer } from "@/lib/data-access/contracts";
import { getPlayerWithState } from "@/lib/data-access/players";
import { getSeasonStatsForPlayers } from "@/lib/data-access/season-stats";
import { getStintsForPlayer } from "@/lib/data-access/player-history";
import { getTeamById } from "@/lib/data-access/teams";
import { getPlayerDemandState } from "@/lib/data-access/trade-requests";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { prisma } from "@/lib/prisma";
import { minAcceptableSalary } from "@/lib/careers/player-demands";
import { PROMISE_TYPES } from "@/lib/careers/promise-rules";
import { PlayerAvatar } from "@/components/team/PlayerAvatar";
import { ExtendContractForm } from "@/components/team/ExtendContractForm";
import { PromoteContractForm } from "@/components/team/PromoteContractForm";
import { MakePromiseForm } from "@/components/team/MakePromiseForm";
import { releasePlayer, offerAlternateContract } from "@/app/actions/roster";
import { MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { injuryChance, injuryRiskLevel } from "@/lib/careers/injury-rules";
import { WEAR_NEEDS_REST } from "@/lib/careers/wear-rules";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import {
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  DEVELOPMENT_CONTRACT_GAME_LIMIT,
  EXTENSION_MAX_YEARS_REMAINING,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { SALARY_RANGES } from "@/lib/careers/salary-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatGameDate, formatSalary, teamFullName } from "@/lib/utils";
import type { PlayerRatings } from "@/lib/types";
import { inverseRatingTone, ratingTone, toneClass, type ScaleTone } from "@/lib/color-scale";

function ratingLabels(t: Translator): Record<keyof PlayerRatings, string> {
  return {
    scoringInside: t("rating.scoringInside"),
    scoringOutside: t("rating.scoringOutside"),
    playmaking: t("rating.playmaking"),
    defenseInside: t("rating.defenseInside"),
    defenseOutside: t("rating.defenseOutside"),
    rebounding: t("rating.rebounding"),
    athleticism: t("rating.athleticism"),
    basketballIQ: t("rating.basketballIQ"),
    clutch: t("rating.clutch"),
    stamina: t("rating.stamina"),
  };
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const membership = await getCurrentMembership();
  const { playerId } = await params;
  const { t, locale } = await getTranslator();

  const [player, contract] = await Promise.all([
    getPlayerWithState(membership.careerId, playerId),
    getContractForPlayer(membership.careerId, playerId),
  ]);
  if (!player) notFound();

  // L'équipe actuelle du contrat fait foi, pas le teamId de l'URL — un lien
  // vers cette page (box score, historique, ancien coéquipier...) peut avoir
  // été construit avec l'équipe d'alors ; si la joueuse a été échangée
  // depuis, on affiche quand même sa fiche à jour plutôt qu'un 404. Sans
  // contrat (agent libre, ou coupé depuis), la fiche reste consultable.
  const teamId = contract?.teamId ?? null;
  const team = teamId ? await getTeamById(teamId) : null;
  if (contract && !team) notFound();
  const leagueId = team?.leagueId ?? membership.leagueId;
  // Sans contrat : retraité ou agent libre (libellé différent, même fiche).
  const retired = contract
    ? false
    : Boolean(
        (
          await prisma.playerState.findUnique({
            where: { careerId_playerId: { careerId: membership.careerId, playerId } },
            select: { retired: true },
          })
        )?.retired
      );

  const isMyTeam = team?.id === membership.teamId;

  // Médical : historique des blessures et risque du prochain match (mêmes
  // facteurs que la simulation, avec le staff et l'entraînement de son équipe).
  const [injuryHistory, medicalTeamState] = await Promise.all([
    prisma.injuryRecord.findMany({
      where: { careerId: membership.careerId, playerId },
      orderBy: { gameDate: "desc" },
      take: 10,
    }),
    team ? getOrCreateTeamState(membership.careerId, team.id, team.leagueId) : Promise.resolve(null),
  ]);
  const medicalFocus = medicalTeamState?.trainingFocus ?? null;
  const riskChance = injuryChance({
    injuryRisk: player.injuryRisk,
    fatigue: player.fatigue,
    wear: player.wear ?? 0,
    age: player.age,
    facilitiesLevel: medicalTeamState?.facilitiesLevel ?? 50,
    medicalLevel: medicalTeamState?.trainingStaffLevel ?? 50,
    intensity:
      medicalFocus && medicalFocus !== "rest"
        ? (medicalTeamState!.trainingIntensity as "low" | "medium" | "high")
        : null,
    played: true,
  });
  const riskLevel = injuryRiskLevel(riskChance);

  const [seasonStats, stints, standardRosterSize, altSlotsUsed, demandState, tradeDeadlinePassed] = await Promise.all([
    getSeasonStatsForPlayers(membership.careerId, membership.season, [playerId]),
    getStintsForPlayer(membership.careerId, playerId),
    teamId
      ? prisma.contract.count({ where: { careerId: membership.careerId, teamId, contractType: "standard" } })
      : Promise.resolve(0),
    teamId
      ? prisma.contract.count({ where: { careerId: membership.careerId, teamId, contractType: { not: "standard" } } })
      : Promise.resolve(0),
    isMyTeam ? getPlayerDemandState(membership.careerId, playerId) : Promise.resolve(null),
    isTradeDeadlinePassed(membership.careerId, membership.season),
  ]);
  const stats = seasonStats.get(playerId) ?? {
    gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0,
  };

  // Visible seulement pour mon équipe — état persisté (voir
  // trade-requests.ts), plus recalculé en direct à chaque rendu : purement
  // informatif, n'affecte aucune mécanique par lui-même (seule la promesse
  // en réponse a un effet, voir plus bas).
  const reasons = demandState?.reasons ?? [];
  const tradeReasonLabels: Record<(typeof reasons)[number], string> = {
    competitiveness: t("domain.tradeReason.competitiveness"),
    market: t("domain.tradeReason.market"),
    morale: t("domain.tradeReason.morale"),
    facilities: t("domain.tradeReason.facilities"),
  };

  const canRelease =
    !!contract &&
    isMyTeam &&
    (contract.contractType !== "standard" ||
      standardRosterSize > (MIN_ROSTER_SIZE[leagueId] ?? MIN_ROSTER_SIZE.nba));
  const canExtend =
    !!contract &&
    isMyTeam &&
    contract.contractType === "standard" &&
    contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING;
  const salaryRange = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  // Suggestion de départ pour l'offre du GM — plancher exigé par le joueur (0
  // pour un rookie encore sous contrat rookie, qui n'a aucune exigence).
  // Aussi l'exigence affichée pour un agent libre.
  const suggestedSalary = contract?.isRookieScale
    ? contract.salary
    : minAcceptableSalary(player.renown, player.overallRating, leagueId);
  const altType = ALT_CONTRACT_TYPE[leagueId];
  const altTypeLabel = altType ? t(`domain.contractType.${altType}` as const) : "";
  const contractTypeLabels: Record<string, string> = {
    standard: t("domain.contractType.standard"),
    two_way: t("domain.contractType.two_way"),
    development: t("domain.contractType.development"),
  };
  const stintReasonLabels: Record<string, string> = {
    drafted: t("domain.stintReason.drafted"),
    signed: t("domain.stintReason.signed"),
    traded: t("domain.stintReason.traded"),
  };
  const canOfferAlternate =
    !!contract &&
    isMyTeam &&
    contract.contractType === "standard" &&
    !!altType &&
    isEligibleForAlternateContract(player.age) &&
    altSlotsUsed < (ALT_CONTRACT_SLOTS_PER_TEAM[leagueId] ?? 0);
  const canPromote = !!contract && isMyTeam && contract.contractType !== "standard";
  const activationLimitReached =
    contract?.contractType === "development" &&
    contract.developmentGamesActivated >= DEVELOPMENT_CONTRACT_GAME_LIMIT;

  const ratingLabel = ratingLabels(t);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} firstName={player.firstName} lastName={player.lastName} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            #{player.jerseyNumber} {player.firstName} {player.lastName}
          </h1>
          <p className="text-sm text-muted">
            {team ? (
              <Link href={`/teams/${team.id}`} className="hover:underline">
                {teamFullName(team)}
              </Link>
            ) : retired ? (
              <span>{t("player.retired")}</span>
            ) : (
              <Link href="/free-agents" className="text-accent-text hover:underline">
                {t("player.freeAgent")}
              </Link>
            )}{" "}
            · {player.position} · {player.heightCm} cm ·{" "}
            {t("player.ageLabel", { age: player.age })} · {player.nationality}
          </p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm text-warn">
          <p className="font-medium">{t("player.wantsTradeHeading")}</p>
          <ul className="mt-1 list-inside list-disc">
            {reasons.map((reason) => (
              <li key={reason}>{tradeReasonLabels[reason]}</li>
            ))}
          </ul>

          {isMyTeam && demandState?.wantsTrade && (
            <div className="mt-3 border-t border-warn/20 pt-3">
              {demandState.activePromiseType ? (
                <p className="text-warn">
                  {t("promise.pendingPrefix")}{" "}
                  {t(`domain.promiseType.${demandState.activePromiseType}` as const)}
                  {demandState.activePromiseSeason ? ` — ${demandState.activePromiseSeason}` : ""}
                </p>
              ) : (
                <MakePromiseForm
                  playerId={player.id}
                  availableTypes={PROMISE_TYPES.filter(
                    (type) => (type !== "renewal" || canExtend) && (type !== "trade" || !tradeDeadlinePassed)
                  )}
                  labels={{
                    selectLabel: t("promise.selectLabel"),
                    submitButton: t("promise.submitButton"),
                    submitting: t("common.proposing"),
                    typeLabels: {
                      renewal: t("domain.promiseType.renewal"),
                      trade: t("domain.promiseType.trade"),
                      facilities: t("domain.promiseType.facilities"),
                      competitiveness: t("domain.promiseType.competitiveness"),
                    },
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("player.seasonStats")}
        </h2>
        <div className="flex flex-wrap gap-6">
          <Stat label={t("player.gamesPlayed")} value={stats.gamesPlayed} />
          <Stat label={t("player.pointsPerGame")} value={stats.ppg} />
          <Stat label={t("player.reboundsPerGame")} value={stats.rpg} />
          <Stat label={t("player.assistsPerGame")} value={stats.apg} />
        </div>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("player.attributes")}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Stat label={t("player.overall")} value={player.overallRating} bold tone={ratingTone(player.overallRating)} />
          {(Object.keys(ratingLabel) as (keyof PlayerRatings)[]).map((key) => (
            <Stat
              key={key}
              label={ratingLabel[key]}
              value={player.ratings[key]}
              tone={ratingTone(player.ratings[key])}
            />
          ))}
          <Stat label={t("player.injuryRisk")} value={player.injuryRisk} tone={inverseRatingTone(player.injuryRisk)} />
          <Stat label={t("player.renown")} value={player.renown} tone={ratingTone(player.renown)} />
          <Stat label={t("player.fatigue")} value={player.fatigue} tone={inverseRatingTone(player.fatigue)} />
          <Stat label={t("player.conditioning")} value={player.conditioning} tone={ratingTone(player.conditioning)} />
          {player.trainingBoost > 0 && player.trainingBoostFocus && (
            <Stat label={t("player.trainingBonus")} value={`+${player.trainingBoost}`} />
          )}
        </div>
      </div>

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("team.tab.medical")}</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat
            label={t("team.medical.energy")}
            value={100 - Math.min(99, player.fatigue)}
            tone={ratingTone(100 - Math.min(99, player.fatigue))}
          />
          <Stat label={t("team.medical.wear")} value={player.wear ?? 0} tone={inverseRatingTone(player.wear ?? 0)} />
          <Stat label={t("team.medical.condition")} value={player.conditioning} tone={ratingTone(player.conditioning)} />
          <Stat
            label={t("pressPage.playerMorale")}
            value={`${t(`pressPage.moraleLevel.${moraleLevel(player.morale ?? 60)}` as "pressPage.moraleLevel.good")} · ${player.morale ?? 60}`}
            tone={ratingTone(player.morale ?? 60)}
          />
          {!player.injured && (
            <Stat
              label={t("team.medical.risk")}
              value={`${t(riskLevel === "low" ? "team.medical.riskLow" : riskLevel === "medium" ? "team.medical.riskMedium" : "team.medical.riskHigh")} (${(riskChance * 100).toFixed(1)} %)`}
              tone={riskLevel === "low" ? "good" : riskLevel === "medium" ? "average" : "bad"}
            />
          )}
        </div>
        {player.injured && player.injuryType && (
          <p className="mt-3 text-sm text-bad">
            {t(`domain.injuryType.${player.injuryType}` as "domain.injuryType.illness")} ·{" "}
            {t("team.medical.games", { count: player.injuryGamesRemaining })}
          </p>
        )}
        {!player.injured && (player.wear ?? 0) >= WEAR_NEEDS_REST && (
          <p className="mt-3 text-sm text-warn">{t("team.medical.needRest")}</p>
        )}
        <h3 className="eyebrow mb-2 mt-4">{t("team.medical.history")}</h3>
        {injuryHistory.length === 0 ? (
          <p className="text-sm text-muted">{t("team.medical.noHistory")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {injuryHistory.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>
                  <span className="text-faint tabular">{formatGameDate(h.gameDate.toISOString(), locale)}</span>{" "}
                  {t(`domain.injuryType.${h.injuryType}` as "domain.injuryType.illness")}
                </span>
                <span className="text-xs text-muted">{t("team.medical.games", { count: h.gamesOut })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!contract && !retired && (
        <div className="mt-6 card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("player.contract")}
          </h2>
          <p className="text-xl font-semibold">{t("player.freeAgent")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("player.salaryDemand", { amount: formatSalary(suggestedSalary, locale) })} ·{" "}
            <Link href="/free-agents" className="text-accent-text hover:underline">
              {t("player.seeFreeAgents")}
            </Link>
          </p>
        </div>
      )}

      {contract && (
        <div className="mt-6 card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("player.contract")}
          </h2>
          <p className="text-xl font-semibold">
            {formatSalary(contract.salary, locale)}
            <span className="ml-2 text-sm font-normal text-muted">
              {t(contract.yearsRemaining > 1 ? "player.yearsRemainingMany" : "player.yearRemainingOne", {
                count: contract.yearsRemaining,
              })}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {contractTypeLabels[contract.contractType]}
            {!contract.guaranteed && t("player.notGuaranteedSuffix")}
            {contract.contractType === "development" && (
              <>
                {" · "}
                {t("player.activationCount", {
                  count: contract.developmentGamesActivated,
                  limit: DEVELOPMENT_CONTRACT_GAME_LIMIT,
                })}
              </>
            )}
          </p>
          {activationLimitReached && (
            <p className="mt-1 text-sm text-bad">{t("player.activationLimitReached")}</p>
          )}

          {canExtend && (
            <div className="mt-4 card p-3">
              <p className="text-sm font-medium">{t("player.proposeExtension")}</p>
              <ExtendContractForm
                playerId={player.id}
                minSalary={salaryRange.min}
                maxSalary={salaryRange.max}
                suggestedSalary={suggestedSalary}
                suggestedYears={2}
                isRookieScale={contract.isRookieScale}
                labels={{
                  proposedSalary: t("extend.proposedSalary"),
                  duration: t("extend.duration"),
                  proposing: t("common.proposing"),
                  proposeButton: t("extend.proposeButton"),
                  rookieNote: t("extend.rookieNote"),
                }}
              />
            </div>
          )}

          {isMyTeam && (
            <div className="mt-4 flex flex-wrap gap-2">
              {canRelease && (
                <form action={releasePlayer}>
                  <input type="hidden" name="playerId" value={player.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-bad/30 px-4 py-1.5 text-sm font-medium text-bad hover:bg-bad/10"
                  >
                    {t("player.cut")}
                  </button>
                </form>
              )}
              {canOfferAlternate && altType && (
                <form action={offerAlternateContract}>
                  <input type="hidden" name="playerId" value={player.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-line px-4 py-1.5 text-sm font-medium hover:bg-surface-2"
                  >
                    {t("player.proposeAltContract", { type: altTypeLabel })}
                  </button>
                </form>
              )}
              {canPromote && (
                <PromoteContractForm
                  playerId={player.id}
                  labels={{ button: t("player.promoteToStandard"), proposing: t("common.proposing") }}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("player.formerClubs")}
        </h2>
        {stints.length === 0 ? (
          <p className="text-sm text-muted">{t("player.noHistory")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stints.map((stint) => (
              <li key={stint.id} className="flex items-center justify-between">
                <Link href={`/teams/${stint.teamId}`} className="hover:underline">
                  {stint.teamCity} {stint.teamName} ({stint.teamAbbreviation})
                </Link>
                <span className="text-muted">
                  {stint.season} · {stintReasonLabels[stint.reason] ?? stint.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  bold = false,
  tone,
}: {
  label: string;
  value: number | string;
  bold?: boolean;
  tone?: ScaleTone;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 ${bold ? "text-lg font-semibold" : ""} ${tone ? toneClass(tone) : ""}`}>{value}</p>
    </div>
  );
}

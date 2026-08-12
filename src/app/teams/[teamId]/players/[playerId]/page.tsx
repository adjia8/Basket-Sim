import { notFound } from "next/navigation";
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
import {
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  DEVELOPMENT_CONTRACT_GAME_LIMIT,
  EXTENSION_MAX_YEARS_REMAINING,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { SALARY_RANGES } from "@/lib/careers/salary-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatSalary, teamFullName } from "@/lib/utils";
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
  const { teamId, playerId } = await params;
  const { t, locale } = await getTranslator();

  const [team, player, contract] = await Promise.all([
    getTeamById(teamId),
    getPlayerWithState(membership.careerId, playerId),
    getContractForPlayer(membership.careerId, playerId),
  ]);
  if (!team || !player || !contract || contract.teamId !== teamId) notFound();

  const isMyTeam = team.id === membership.teamId;

  const [seasonStats, stints, standardRosterSize, altSlotsUsed, demandState, tradeDeadlinePassed] = await Promise.all([
    getSeasonStatsForPlayers(membership.careerId, membership.season, [playerId]),
    getStintsForPlayer(membership.careerId, playerId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: "standard" },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: { not: "standard" } },
    }),
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
    facilities: t("domain.tradeReason.facilities"),
  };

  const canRelease =
    isMyTeam &&
    (contract.contractType !== "standard" ||
      standardRosterSize > (MIN_ROSTER_SIZE[team.leagueId] ?? MIN_ROSTER_SIZE.nba));
  const canExtend =
    isMyTeam && contract.contractType === "standard" && contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING;
  const salaryRange = SALARY_RANGES[team.leagueId] ?? SALARY_RANGES.nba;
  // Suggestion de départ pour l'offre du GM — plancher exigé par le joueur (0
  // pour un rookie encore sous contrat rookie, qui n'a aucune exigence).
  const suggestedSalary = contract.isRookieScale
    ? contract.salary
    : minAcceptableSalary(player.renown, player.overallRating, team.leagueId);
  const altType = ALT_CONTRACT_TYPE[team.leagueId];
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
    isMyTeam &&
    contract.contractType === "standard" &&
    !!altType &&
    isEligibleForAlternateContract(player.age) &&
    altSlotsUsed < ALT_CONTRACT_SLOTS_PER_TEAM;
  const canPromote = isMyTeam && contract.contractType !== "standard";
  const activationLimitReached =
    contract.contractType === "development" &&
    contract.developmentGamesActivated >= DEVELOPMENT_CONTRACT_GAME_LIMIT;

  const ratingLabel = ratingLabels(t);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} firstName={player.firstName} lastName={player.lastName} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">
            #{player.jerseyNumber} {player.firstName} {player.lastName}
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            {teamFullName(team)} · {player.position} · {player.heightCm} cm ·{" "}
            {t("player.ageLabel", { age: player.age })} · {player.nationality}
          </p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-600 dark:text-orange-400">
          <p className="font-medium">{t("player.wantsTradeHeading")}</p>
          <ul className="mt-1 list-inside list-disc">
            {reasons.map((reason) => (
              <li key={reason}>{tradeReasonLabels[reason]}</li>
            ))}
          </ul>

          {isMyTeam && demandState?.wantsTrade && (
            <div className="mt-3 border-t border-orange-500/20 pt-3">
              {demandState.activePromiseType ? (
                <p className="text-orange-600 dark:text-orange-400">
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

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("player.seasonStats")}
        </h2>
        <div className="flex flex-wrap gap-6">
          <Stat label={t("player.gamesPlayed")} value={stats.gamesPlayed} />
          <Stat label={t("player.pointsPerGame")} value={stats.ppg} />
          <Stat label={t("player.reboundsPerGame")} value={stats.rpg} />
          <Stat label={t("player.assistsPerGame")} value={stats.apg} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
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

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("player.contract")}
        </h2>
        <p className="text-xl font-semibold">
          {formatSalary(contract.salary, locale)}
          <span className="ml-2 text-sm font-normal text-black/50 dark:text-white/50">
            {t(contract.yearsRemaining > 1 ? "player.yearsRemainingMany" : "player.yearRemainingOne", {
              count: contract.yearsRemaining,
            })}
          </span>
        </p>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
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
          <p className="mt-1 text-sm text-red-500">{t("player.activationLimitReached")}</p>
        )}

        {canExtend && (
          <div className="mt-4 rounded-lg border border-black/10 p-3 dark:border-white/10">
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
                  className="rounded-full border border-red-500/30 px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
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
                  className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
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

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          {t("player.formerClubs")}
        </h2>
        {stints.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">{t("player.noHistory")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stints.map((stint) => (
              <li key={stint.id} className="flex items-center justify-between">
                <span>
                  {stint.teamCity} {stint.teamName} ({stint.teamAbbreviation})
                </span>
                <span className="text-black/50 dark:text-white/50">
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
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{label}</p>
      <p className={`mt-0.5 ${bold ? "text-lg font-semibold" : ""} ${tone ? toneClass(tone) : ""}`}>{value}</p>
    </div>
  );
}

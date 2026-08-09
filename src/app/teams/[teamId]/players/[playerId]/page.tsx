import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getContractForPlayer } from "@/lib/data-access/contracts";
import { getPlayerWithState } from "@/lib/data-access/players";
import { getSeasonStatsForPlayers } from "@/lib/data-access/season-stats";
import { getStintsForPlayer } from "@/lib/data-access/player-history";
import { getStandings } from "@/lib/data-access/standings";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getTeamById } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import {
  TRADE_REQUEST_REASON_LABELS,
  minAcceptableSalary,
  tradeRequestReasons,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import { PlayerAvatar } from "@/components/team/PlayerAvatar";
import { ExtendContractForm } from "@/components/team/ExtendContractForm";
import { releasePlayer, offerAlternateContract } from "@/app/actions/roster";
import { MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import {
  ALT_CONTRACT_LABEL,
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  EXTENSION_MAX_YEARS_REMAINING,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { SALARY_RANGES } from "@/lib/careers/salary-rules";
import { formatSalary, teamFullName } from "@/lib/utils";
import type { PlayerRatings } from "@/lib/types";
import { inverseRatingTone, ratingTone, toneClass, type ScaleTone } from "@/lib/color-scale";

const RATING_LABELS: Record<keyof PlayerRatings, string> = {
  scoringInside: "Scoring intérieur",
  scoringOutside: "Scoring extérieur",
  playmaking: "Playmaking",
  defenseInside: "Défense intérieure",
  defenseOutside: "Défense extérieure",
  rebounding: "Rebonds",
  athleticism: "Athlétisme",
  basketballIQ: "QI basket",
  clutch: "Clutch",
  stamina: "Stamina",
};

const REASON_LABELS: Record<string, string> = {
  drafted: "Repêché",
  signed: "Signé",
  traded: "Échangé",
};

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const membership = await getCurrentMembership();
  const { teamId, playerId } = await params;

  const [team, player, contract] = await Promise.all([
    getTeamById(teamId),
    getPlayerWithState(membership.careerId, playerId),
    getContractForPlayer(membership.careerId, playerId),
  ]);
  if (!team || !player || !contract || contract.teamId !== teamId) notFound();

  const isMyTeam = team.id === membership.teamId;

  const [seasonStats, stints, standardRosterSize, altSlotsUsed, standings, teamState] = await Promise.all([
    getSeasonStatsForPlayers(membership.careerId, membership.season, [playerId]),
    getStintsForPlayer(membership.careerId, playerId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: "standard" },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: { not: "standard" } },
    }),
    getStandings(membership.careerId, team.leagueId, membership.season),
    getOrCreateTeamState(membership.careerId, teamId, team.leagueId),
  ]);
  const stats = seasonStats.get(playerId) ?? {
    gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0,
  };

  // Visible seulement pour mon équipe — même convention que le badge dans
  // RosterTable (données purement informatives, sans effet sur le gameplay).
  const teamStandingsRow = standings.find((row) => row.teamId === teamId);
  const reasons = isMyTeam
    ? tradeRequestReasons({
        renown: player.renown,
        overallRating: player.overallRating,
        salary: contract.salary,
        leagueId: team.leagueId,
        teamWinPct: winPctForStandings(teamStandingsRow?.wins ?? 0, teamStandingsRow?.losses ?? 0),
        teamMarketAppeal: team.marketAppeal,
        teamFacilitiesLevel: teamState.facilitiesLevel,
        isRookieScale: contract.isRookieScale,
      })
    : [];

  const canRelease =
    isMyTeam && (contract.contractType !== "standard" || standardRosterSize > MIN_ROSTER_SIZE);
  const canExtend =
    isMyTeam && contract.contractType === "standard" && contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING;
  const salaryRange = SALARY_RANGES[team.leagueId] ?? SALARY_RANGES.nba;
  // Suggestion de départ pour l'offre du GM — plancher exigé par le joueur (0
  // pour un rookie encore sous contrat rookie, qui n'a aucune exigence).
  const suggestedSalary = contract.isRookieScale
    ? contract.salary
    : minAcceptableSalary(player.renown, player.overallRating, team.leagueId);
  const altType = ALT_CONTRACT_TYPE[team.leagueId];
  const canOfferAlternate =
    isMyTeam &&
    contract.contractType === "standard" &&
    !!altType &&
    isEligibleForAlternateContract(player.age) &&
    altSlotsUsed < ALT_CONTRACT_SLOTS_PER_TEAM;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} firstName={player.firstName} lastName={player.lastName} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">
            #{player.jerseyNumber} {player.firstName} {player.lastName}
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            {teamFullName(team)} · {player.position} · {player.heightCm} cm · {player.age} ans · {player.nationality}
          </p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-600 dark:text-orange-400">
          <p className="font-medium">🚩 Veut être échangé</p>
          <ul className="mt-1 list-inside list-disc">
            {reasons.map((reason) => (
              <li key={reason}>{TRADE_REQUEST_REASON_LABELS[reason]}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Statistiques de la saison
        </h2>
        <div className="flex flex-wrap gap-6">
          <Stat label="Matchs joués" value={stats.gamesPlayed} />
          <Stat label="Points/match" value={stats.ppg} />
          <Stat label="Rebonds/match" value={stats.rpg} />
          <Stat label="Passes/match" value={stats.apg} />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Attributs
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Stat label="Overall" value={player.overallRating} bold tone={ratingTone(player.overallRating)} />
          {(Object.keys(RATING_LABELS) as (keyof PlayerRatings)[]).map((key) => (
            <Stat
              key={key}
              label={RATING_LABELS[key]}
              value={player.ratings[key]}
              tone={ratingTone(player.ratings[key])}
            />
          ))}
          <Stat label="Risque blessure" value={player.injuryRisk} tone={inverseRatingTone(player.injuryRisk)} />
          <Stat label="Renommé" value={player.renown} tone={ratingTone(player.renown)} />
          <Stat label="Fatigue" value={player.fatigue} tone={inverseRatingTone(player.fatigue)} />
          <Stat label="Conditionnement" value={player.conditioning} tone={ratingTone(player.conditioning)} />
          {player.trainingBoost > 0 && player.trainingBoostFocus && (
            <Stat label="Bonus entraînement" value={`+${player.trainingBoost}`} />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Contrat
        </h2>
        <p className="text-xl font-semibold">
          {formatSalary(contract.salary)}
          <span className="ml-2 text-sm font-normal text-black/50 dark:text-white/50">
            {contract.yearsRemaining} an{contract.yearsRemaining > 1 ? "s" : ""} restant
            {contract.yearsRemaining > 1 ? "s" : ""}
          </span>
        </p>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {ALT_CONTRACT_LABEL[contract.contractType]}
          {!contract.guaranteed && " · non garanti"}
        </p>

        {canExtend && (
          <div className="mt-4 rounded-lg border border-black/10 p-3 dark:border-white/10">
            <p className="text-sm font-medium">Proposer une prolongation</p>
            <ExtendContractForm
              playerId={player.id}
              minSalary={salaryRange.min}
              maxSalary={salaryRange.max}
              suggestedSalary={suggestedSalary}
              suggestedYears={2}
              isRookieScale={contract.isRookieScale}
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
                  Couper
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
                  Proposer un contrat {ALT_CONTRACT_LABEL[altType]}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Anciens clubs
        </h2>
        {stints.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Aucun historique enregistré (disponible à partir du prochain repêchage/signature/échange).
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stints.map((stint) => (
              <li key={stint.id} className="flex items-center justify-between">
                <span>
                  {stint.teamCity} {stint.teamName} ({stint.teamAbbreviation})
                </span>
                <span className="text-black/50 dark:text-white/50">
                  {stint.season} · {REASON_LABELS[stint.reason] ?? stint.reason}
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

import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getContractForPlayer } from "@/lib/data-access/contracts";
import { getPlayerWithState } from "@/lib/data-access/players";
import { getSeasonStatsForPlayers } from "@/lib/data-access/season-stats";
import { getStintsForPlayer } from "@/lib/data-access/player-history";
import { getTeamById } from "@/lib/data-access/teams";
import { prisma } from "@/lib/prisma";
import { PlayerAvatar } from "@/components/team/PlayerAvatar";
import {
  releasePlayer,
  extendContract,
  offerAlternateContract,
} from "@/app/actions/roster";
import { MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import {
  ALT_CONTRACT_LABEL,
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  EXTENSION_MAX_YEARS_REMAINING,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { formatSalary, teamFullName } from "@/lib/utils";
import type { PlayerRatings } from "@/lib/types";

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

  const [seasonStats, stints, standardRosterSize, altSlotsUsed] = await Promise.all([
    getSeasonStatsForPlayers(membership.careerId, membership.season, [playerId]),
    getStintsForPlayer(membership.careerId, playerId),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: "standard" },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId, contractType: { not: "standard" } },
    }),
  ]);
  const stats = seasonStats.get(playerId) ?? {
    gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, ppg: 0, rpg: 0, apg: 0,
  };

  const canRelease =
    isMyTeam && (contract.contractType !== "standard" || standardRosterSize > MIN_ROSTER_SIZE);
  const canExtend =
    isMyTeam && contract.contractType === "standard" && contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING;
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
          <Stat label="Overall" value={player.overallRating} bold />
          {(Object.keys(RATING_LABELS) as (keyof PlayerRatings)[]).map((key) => (
            <Stat key={key} label={RATING_LABELS[key]} value={player.ratings[key]} />
          ))}
          <Stat label="Risque blessure" value={player.injuryRisk} />
          <Stat label="Renommé" value={player.renown} />
          <Stat label="Fatigue" value={player.fatigue} />
          <Stat label="Conditionnement" value={player.conditioning} />
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
            {canExtend && (
              <form action={extendContract}>
                <input type="hidden" name="playerId" value={player.id} />
                <button
                  type="submit"
                  className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                >
                  Prolonger
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

function Stat({ label, value, bold = false }: { label: string; value: number | string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{label}</p>
      <p className={`mt-0.5 ${bold ? "text-lg font-semibold" : ""}`}>{value}</p>
    </div>
  );
}

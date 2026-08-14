import { notFound } from "next/navigation";
import Link from "next/link";
import { BoxScoreTable } from "@/components/game/BoxScoreTable";
import { GameRosterPreview } from "@/components/game/GameRosterPreview";
import { SimulateButton } from "@/components/game/SimulateButton";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPlayerById, getRosterForTeam } from "@/lib/data-access/players";
import { getGameById } from "@/lib/data-access/schedule";
import { getSeasonStatsForPlayers } from "@/lib/data-access/season-stats";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatGameDate, ordinalSuffix, teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const { gameId } = await params;
  const game = await getGameById(membership.careerId, gameId);
  if (!game) notFound();

  const [homeTeam, awayTeam, homeManager, awayManager] = await Promise.all([
    getTeamById(game.homeTeamId),
    getTeamById(game.awayTeamId),
    getMembershipForTeam(membership.careerId, game.homeTeamId),
    getMembershipForTeam(membership.careerId, game.awayTeamId),
  ]);
  if (!homeTeam || !awayTeam) notFound();

  const boxScoreWithNames = game.boxScore
    ? await Promise.all(
        game.boxScore.map(async (entry) => ({
          ...entry,
          player: await getPlayerById(entry.playerId),
        }))
      )
    : [];

  // Aperçu des effectifs (roster + moyennes + bilan/classement) affiché
  // avant simulation seulement — une fois le match joué, le box score réel
  // remplace cet aperçu, aucune raison de payer ces requêtes en plus.
  let awayRoster: Awaited<ReturnType<typeof getRosterForTeam>> = [];
  let homeRoster: Awaited<ReturnType<typeof getRosterForTeam>> = [];
  let seasonStats: Awaited<ReturnType<typeof getSeasonStatsForPlayers>> = new Map();
  let standings: Awaited<ReturnType<typeof getStandings>> = [];
  let awayRank = 0;
  let homeRank = 0;
  if (game.status === "scheduled") {
    [awayRoster, homeRoster, standings] = await Promise.all([
      getRosterForTeam(membership.careerId, game.awayTeamId),
      getRosterForTeam(membership.careerId, game.homeTeamId),
      getStandings(membership.careerId, game.leagueId, game.season),
    ]);
    seasonStats = await getSeasonStatsForPlayers(
      membership.careerId,
      game.season,
      [...awayRoster, ...homeRoster].map((p) => p.id)
    );
    awayRank = standings.findIndex((s) => s.teamId === game.awayTeamId) + 1 || standings.length;
    homeRank = standings.findIndex((s) => s.teamId === game.homeTeamId) + 1 || standings.length;
  }
  const awayStandingsRow = standings.find((s) => s.teamId === game.awayTeamId);
  const homeStandingsRow = standings.find((s) => s.teamId === game.homeTeamId);

  const mySide: "home" | "away" | null =
    game.homeTeamId === membership.teamId
      ? "home"
      : game.awayTeamId === membership.teamId
        ? "away"
        : null;

  let initialWaitingFor: string | null = null;
  if (mySide === "home" && game.homeReady && awayManager && !game.awayReady) {
    initialWaitingFor = awayManager.email;
  } else if (mySide === "away" && game.awayReady && homeManager && !game.homeReady) {
    initialWaitingFor = homeManager.email;
  }

  // Un match opposant deux équipes IA n'a pas de "propriétaire" : n'importe
  // quel membre de la ligue peut le déclencher (nécessaire pour pouvoir
  // terminer la saison), même s'il ne gère ni l'une ni l'autre équipe.
  const canAct = mySide !== null || (!homeManager && !awayManager);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-black/50 dark:text-white/50">
          {formatGameDate(game.gameDate, locale)}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          <Link href={`/teams/${awayTeam.id}`} className="hover:underline">
            {teamFullName(awayTeam)}
          </Link>{" "}
          @{" "}
          <Link href={`/teams/${homeTeam.id}`} className="hover:underline">
            {teamFullName(homeTeam)}
          </Link>
        </h1>

        <div className="mt-6 flex items-center justify-center gap-8 rounded-xl border border-black/10 py-8 dark:border-white/10">
          <TeamScore team={awayTeam} score={game.awayScore} />
          <span className="text-black/30 dark:text-white/30">–</span>
          <TeamScore team={homeTeam} score={game.homeScore} />
        </div>

        {game.status === "scheduled" && (
          <div className="mt-6 flex flex-col items-center gap-2">
            {canAct ? (
              <SimulateButton
                gameId={game.id}
                initialWaitingFor={initialWaitingFor}
                labels={{
                  simulate: t("game.simulate"),
                  simulating: t("game.simulating"),
                  waitingForPrefix: t("game.waitingForPrefix"),
                  simulationFailed: t("game.simulationFailed"),
                  unknownError: t("game.unknownError"),
                  otherManagerFallback: t("game.otherManagerFallback"),
                }}
              />
            ) : (
              <p className="text-sm text-black/50 dark:text-white/50">
                {readinessLine(t, awayTeam, game.awayReady, awayManager)} ·{" "}
                {readinessLine(t, homeTeam, game.homeReady, homeManager)}
              </p>
            )}
          </div>
        )}
      </div>

      {game.status === "scheduled" ? (
        <div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <GameRosterPreview
              team={awayTeam}
              roster={awayRoster}
              seasonStats={seasonStats}
              labels={{
                record: `${awayStandingsRow?.wins ?? 0}-${awayStandingsRow?.losses ?? 0}`,
                rank: `${awayRank}${ordinalSuffix(awayRank, locale)}/${standings.length}`,
                player: t("roster.column.player"),
                position: t("roster.column.position"),
                overall: t("roster.column.overall"),
                ppg: t("roster.column.ppg"),
                rpg: t("roster.column.rpg"),
                apg: t("roster.column.apg"),
              }}
            />
            <GameRosterPreview
              team={homeTeam}
              roster={homeRoster}
              seasonStats={seasonStats}
              labels={{
                record: `${homeStandingsRow?.wins ?? 0}-${homeStandingsRow?.losses ?? 0}`,
                rank: `${homeRank}${ordinalSuffix(homeRank, locale)}/${standings.length}`,
                player: t("roster.column.player"),
                position: t("roster.column.position"),
                overall: t("roster.column.overall"),
                ppg: t("roster.column.ppg"),
                rpg: t("roster.column.rpg"),
                apg: t("roster.column.apg"),
              }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">{t("game.boxScoreHeading")}</h2>
          <BoxScoreTable
            entries={boxScoreWithNames}
            homeTeamId={homeTeam.id}
            awayTeamId={awayTeam.id}
            labels={{
              away: t("boxScore.away"),
              home: t("boxScore.home"),
              player: t("boxScore.player"),
              minutes: t("boxScore.minutes"),
              points: t("boxScore.points"),
              fieldGoals: t("boxScore.fieldGoals"),
              threePointers: t("boxScore.threePointers"),
              freeThrows: t("boxScore.freeThrows"),
              rebounds: t("boxScore.rebounds"),
              assists: t("boxScore.assists"),
              steals: t("boxScore.steals"),
              blocks: t("boxScore.blocks"),
              turnovers: t("boxScore.turnovers"),
              fouls: t("boxScore.fouls"),
              team: t("boxScore.team"),
              technical: (count) => t("boxScore.technical", { count }),
              flagrant: (count) => t("boxScore.flagrant", { count }),
              fouledOut: t("boxScore.fouledOut"),
              ejected: t("boxScore.ejected"),
            }}
          />
        </div>
      )}
    </div>
  );
}

function readinessLine(
  t: Translator,
  team: Team,
  ready: boolean,
  manager: { email: string } | null
) {
  const status = !manager ? t("game.ai") : ready ? t("game.ready") : t("game.waiting");
  return (
    <>
      <Link href={`/teams/${team.id}`} className="hover:underline">
        {teamFullName(team)}
      </Link>{" "}
      : {status}
    </>
  );
}

function TeamScore({ team, score }: { team: Team; score?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: team.primaryColor }}
      />
      <Link href={`/teams/${team.id}`} className="font-medium hover:underline">
        {teamFullName(team)}
      </Link>
      <span className="text-3xl font-bold">{score ?? "-"}</span>
    </div>
  );
}

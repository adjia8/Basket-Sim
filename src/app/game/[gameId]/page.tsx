import { notFound } from "next/navigation";
import { BoxScoreTable } from "@/components/game/BoxScoreTable";
import { SimulateButton } from "@/components/game/SimulateButton";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPlayerById } from "@/lib/data-access/players";
import { getGameById } from "@/lib/data-access/schedule";
import { getTeamById } from "@/lib/data-access/teams";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatGameDate, teamFullName } from "@/lib/utils";
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-black/50 dark:text-white/50">
        {formatGameDate(game.gameDate, locale)}
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        {teamFullName(awayTeam)} @ {teamFullName(homeTeam)}
      </h1>

      <div className="mt-6 flex items-center justify-center gap-8 rounded-xl border border-black/10 py-8 dark:border-white/10">
        <TeamScore team={awayTeam} score={game.awayScore} />
        <span className="text-black/30 dark:text-white/30">–</span>
        <TeamScore team={homeTeam} score={game.homeScore} />
      </div>

      {game.status === "scheduled" ? (
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
): string {
  if (!manager) return `${teamFullName(team)} : ${t("game.ai")}`;
  return `${teamFullName(team)} : ${ready ? t("game.ready") : t("game.waiting")}`;
}

function TeamScore({ team, score }: { team: Team; score?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: team.primaryColor }}
      />
      <span className="font-medium">{teamFullName(team)}</span>
      <span className="text-3xl font-bold">{score ?? "-"}</span>
    </div>
  );
}

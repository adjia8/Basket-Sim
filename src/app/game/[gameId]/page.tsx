import { notFound } from "next/navigation";
import { BoxScoreTable } from "@/components/game/BoxScoreTable";
import { SimulateButton } from "@/components/game/SimulateButton";
import { getCurrentCareer } from "@/lib/auth/dal";
import { getPlayerById } from "@/lib/data-access/players";
import { getGameById } from "@/lib/data-access/schedule";
import { getTeamById } from "@/lib/data-access/teams";
import { formatGameDate, teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const career = await getCurrentCareer();
  const { gameId } = await params;
  const game = await getGameById(career.id, gameId);
  if (!game) notFound();

  const [homeTeam, awayTeam] = await Promise.all([
    getTeamById(game.homeTeamId),
    getTeamById(game.awayTeamId),
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm text-black/50 dark:text-white/50">
        {formatGameDate(game.gameDate)}
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
        <div className="mt-6 flex justify-center">
          <SimulateButton gameId={game.id} />
        </div>
      ) : (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Box score</h2>
          <BoxScoreTable
            entries={boxScoreWithNames}
            homeTeamId={homeTeam.id}
            awayTeamId={awayTeam.id}
          />
        </div>
      )}
    </div>
  );
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

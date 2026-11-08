import { notFound, redirect } from "next/navigation";
import { getTacticsReport } from "@/lib/data-access/tactics";
import { PreMatchTactics } from "@/components/game/PreMatchTactics";
import Link from "next/link";
import { BoxScoreTable } from "@/components/game/BoxScoreTable";
import { GameRosterPreview } from "@/components/game/GameRosterPreview";
import { SimulateButton } from "@/components/game/SimulateButton";
import { verifySession, flattenMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPlayerById, getRosterForTeam } from "@/lib/data-access/players";
import { getGameById } from "@/lib/data-access/schedule";
import { getSeasonStatsForPlayers } from "@/lib/data-access/season-stats";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { formatLongDate, ordinalSuffix, teamFullName } from "@/lib/utils";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { toDomainGame } from "@/lib/data-access/mappers";
import { endOfGameDay } from "@/lib/data-access/game-clock";
import { DayResults, GameLeaders, PreMatchComparison, Scoreboard, type TeamSnapshot } from "@/components/game/MatchCenter";
import type { Team } from "@/lib/types";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { HalfState } from "@/lib/simulation/engine";
import type { TalkChoice } from "@/components/game/SimulateButton";
import {
  HALFTIME_TONES,
  PREGAME_TONES,
  halftimeSituation,
  parseTalks,
  pregameSituation,
} from "@/lib/careers/team-talk-rules";

// Ne passe volontairement pas par getCurrentMembership() : celle-ci redirige
// vers /press dès qu'une conférence de presse est en attente, y compris
// celle que le match qu'on vient de simuler peut lui-même déclencher — ce
// qui empêcherait de voir le résultat de SON PROPRE match. Cette page reste
// donc volontairement consultable même avec une conférence en attente
// (répondre peut attendre ; voir son propre score, non). Le contrôle
// pendingReassignment reste appliqué, lui, comme sur les autres pages.
export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { userId } = await verifySession();
  const membershipRow = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true, gmProfile: { select: { pendingReassignment: true } } },
  });
  if (!membershipRow) redirect("/onboarding");
  if (membershipRow.gmProfile?.pendingReassignment) redirect("/onboarding/reassign");
  const membership = flattenMembership(membershipRow);
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
  if (game.status === "scheduled") {
    [awayRoster, homeRoster] = await Promise.all([
      getRosterForTeam(membership.careerId, game.awayTeamId),
      getRosterForTeam(membership.careerId, game.homeTeamId),
    ]);
    seasonStats = await getSeasonStatsForPlayers(
      membership.careerId,
      game.season,
      [...awayRoster, ...homeRoster].map((p) => p.id)
    );
  }

  // Bilans et classement : saison régulière en cours (même pour un match de
  // pré-saison ou de playoffs). Forme : 5 derniers matchs de la même
  // compétition avant celui-ci. Autres matchs : même journée calendaire.
  const gameDate = new Date(game.gameDate);
  const dayStart = new Date(Date.UTC(gameDate.getUTCFullYear(), gameDate.getUTCMonth(), gameDate.getUTCDate()));
  const [standings, leagueTeams, awayForm, homeForm, dayGameRows] = await Promise.all([
    getStandings(membership.careerId, game.leagueId, membership.season),
    getTeamsByLeague(game.leagueId),
    recentForm(membership.careerId, game.season, game.awayTeamId, gameDate),
    recentForm(membership.careerId, game.season, game.homeTeamId, gameDate),
    prisma.game.findMany({
      where: { careerId: membership.careerId, id: { not: game.id }, gameDate: { gte: dayStart, lte: endOfGameDay(gameDate) } },
      orderBy: [{ status: "asc" }, { homeTeamId: "asc" }],
    }),
  ]);
  // Rang affiché seulement une fois la saison régulière commencée (avant,
  // l'ordre du classement à 0-0 ne veut rien dire).
  const rankOf = (teamId: string) => {
    const row = standings.find((s) => s.teamId === teamId);
    return row && row.wins + row.losses > 0 ? standings.indexOf(row) + 1 : 0;
  };
  const awayRank = rankOf(game.awayTeamId);
  const homeRank = rankOf(game.homeTeamId);
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

  // Causeries (voir team-talk-rules.ts) : face à une équipe IA, le match se
  // joue en deux temps avec une causerie avant le coup d'envoi et une à la
  // mi-temps.
  const talkRow = await prisma.game.findUnique({ where: { id: game.id }, select: { halftimeJson: true, talksJson: true } });
  const halftime = talkRow?.halftimeJson ? (JSON.parse(talkRow.halftimeJson) as HalfState) : null;
  const talks = parseTalks(talkRow?.talksJson);
  const opponentIsAi = mySide === "home" ? !awayManager : mySide === "away" ? !homeManager : false;
  const myRoster = mySide === "home" ? homeRoster : awayRoster;
  const theirRoster = mySide === "home" ? awayRoster : homeRoster;
  const level = (roster: typeof homeRoster) => {
    const top = [...roster].filter((p) => !p.injured).sort((a, b) => b.overallRating - a.overallRating).slice(0, 8);
    return top.length ? top.reduce((sum, p) => sum + p.overallRating, 0) / top.length : 0;
  };
  const talkOptions = (tones: string[]) =>
    tones.map((v) => ({
      value: v,
      label: t(`talks.tone.${v}` as DictionaryKey),
      quote: t(`talks.quote.${v}` as DictionaryKey),
    }));
  const pregameTalk: TalkChoice | undefined =
    mySide && opponentIsAi && !halftime
      ? {
          field: "pregameTalk",
          heading: `${t("talks.pregameHeading")} · ${t(
            `talks.situation.${pregameSituation(level(myRoster), level(theirRoster), mySide === "home")}` as DictionaryKey
          )}`,
          hint: t("talks.pregameHint"),
          options: talkOptions(PREGAME_TONES),
        }
      : undefined;
  const myHalfScore = halftime && mySide ? (mySide === "home" ? halftime.homeScore : halftime.awayScore) : 0;
  const theirHalfScore = halftime && mySide ? (mySide === "home" ? halftime.awayScore : halftime.homeScore) : 0;
  const halftimeTalk: TalkChoice | undefined =
    halftime && mySide
      ? {
          field: "halftimeTalk",
          heading: `${t("talks.halftimeHeading")} · ${t(
            `talks.situation.${halftimeSituation(myHalfScore, theirHalfScore)}` as DictionaryKey
          )}`,
          hint: t("talks.halftimeHint"),
          options: talkOptions(HALFTIME_TONES),
        }
      : undefined;
  const nameOf = new Map([...homeRoster, ...awayRoster].map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const halfLeaders = (teamId: string) =>
    (halftime?.boxScore ?? [])
      .filter((e) => e.teamId === teamId)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  const simulateLabels = {
    simulate: t("game.simulate"),
    simulating: t("game.simulating"),
    waitingForPrefix: t("game.waitingForPrefix"),
    simulationFailed: t("game.simulationFailed"),
    unknownError: t("game.unknownError"),
    otherManagerFallback: t("game.otherManagerFallback"),
    timedOut: t("game.timedOut"),
    simulatingHint: t("game.simulatingHint"),
    catchingUp: t("game.catchingUp"),
  };

  // Encart tactique d'avant-match (mon équipe seulement).
  const tacticsReport =
    game.status === "scheduled" && mySide
      ? await getTacticsReport(
          membership.careerId,
          membership.teamId,
          game.leagueId,
          mySide === "home" ? game.awayTeamId : game.homeTeamId
        )
      : null;

  const isFinal = game.status === "final";
  const phase = game.season.endsWith("-preseason") ? "preseason" : game.season.endsWith("-playoffs") ? "playoffs" : "regular";
  const snapshot = (team: Team, roster: typeof awayRoster, form: ("W" | "L")[], rank: number): TeamSnapshot => ({
    team,
    row: standings.find((s) => s.teamId === team.id),
    rank,
    leagueSize: standings.length,
    form,
    injured: roster.filter((p) => p.injured),
  });
  const awaySnapshot = snapshot(awayTeam, awayRoster, awayForm, awayRank);
  const homeSnapshot = snapshot(homeTeam, homeRoster, homeForm, homeRank);
  const teamById = new Map(leagueTeams.map((team) => [team.id, team]));
  const dayResults = (
    <DayResults
      games={dayGameRows.map(toDomainGame)}
      teamById={teamById}
      myTeamId={membership.teamId}
      labels={{ heading: t("game.dayResults"), none: t("game.noOtherGames"), upcoming: t("game.upcoming") }}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="sr-only">
          {teamFullName(awayTeam)} @ {teamFullName(homeTeam)}
        </h1>
        <Scoreboard
          away={awaySnapshot}
          home={homeSnapshot}
          awayScore={game.awayScore}
          homeScore={game.homeScore}
          isFinal={isFinal}
          phaseLabel={t(`common.topbar.phase.${phase}`)}
          statusLabel={isFinal ? t("game.final") : t("game.upcoming")}
          dateLabel={formatLongDate(game.gameDate, locale)}
          rankLabel={(rank, size) => `${rank}${ordinalSuffix(rank, locale)}/${size}`}
        />

        {game.status === "scheduled" && halftime && mySide && (
          <section className="card mt-6 p-4 sm:p-5">
            <p className="eyebrow">{t("talks.halftimeTitle")}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="text-3xl font-bold tabular">
                {awayTeam.abbreviation} {halftime.awayScore} – {halftime.homeScore} {homeTeam.abbreviation}
              </p>
              <p className="text-xs text-muted">{t("talks.halftimeScore")}</p>
            </div>
            {talks?.pregame && (
              <p className="mt-3 text-sm">
                <span className="text-muted">{t("talks.pregameReaction")} : </span>
                <span className={talks.pregame.focus > 0 ? "text-good" : talks.pregame.focus < 0 ? "text-bad" : ""}>
                  {t(`talks.reaction.${talks.pregame.reaction}` as DictionaryKey)}
                </span>
              </p>
            )}
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {[awayTeam, homeTeam].map((team) => (
                <div key={team.id}>
                  <p className="text-xs text-muted">
                    {t("talks.leadersSoFar")} · {team.abbreviation}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {halfLeaders(team.id).map((e) => (
                      <li key={e.playerId} className="flex justify-between gap-2">
                        <span>{nameOf.get(e.playerId) ?? e.playerId}</span>
                        <span className="tabular text-muted">{e.points} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {game.status === "scheduled" && (
          <div className="mt-6 flex flex-col items-center gap-2">
            {canAct ? (
              <SimulateButton
                gameId={game.id}
                initialWaitingFor={initialWaitingFor}
                talk={halftime ? halftimeTalk : pregameTalk}
                mode={halftime ? "resume" : pregameTalk ? "half" : undefined}
                labels={{
                  ...simulateLabels,
                  simulate: halftime ? t("talks.resume") : pregameTalk ? t("talks.kickoff") : simulateLabels.simulate,
                }}
              />
            ) : (
              <p className="text-sm text-muted">
                {readinessLine(t, awayTeam, game.awayReady, awayManager)} ·{" "}
                {readinessLine(t, homeTeam, game.homeReady, homeManager)}
              </p>
            )}
          </div>
        )}
      </div>

      {game.status === "scheduled" ? (
        <div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <PreMatchComparison
              away={awaySnapshot}
              home={homeSnapshot}
              locale={locale}
              labels={{
                heading: t("game.preview"),
                record: t("game.compare.record"),
                rank: t("game.compare.rank"),
                form: t("game.compare.form"),
                pointsFor: t("game.compare.pointsFor"),
                pointsAgainst: t("game.compare.pointsAgainst"),
                injured: t("game.compare.injured"),
                none: t("game.compare.none"),
              }}
            />
            {dayResults}
          </div>
          {tacticsReport && tacticsReport.opponent && (
            <PreMatchTactics report={tacticsReport} myTeamId={membership.teamId} t={t} />
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <GameRosterPreview
              team={awayTeam}
              roster={awayRoster}
              seasonStats={seasonStats}
              gamesPlayed={(awayStandingsRow?.wins ?? 0) + (awayStandingsRow?.losses ?? 0)}
              labels={{
                record: `${awayStandingsRow?.wins ?? 0}-${awayStandingsRow?.losses ?? 0}`,
                rank: awayRank ? `${awayRank}${ordinalSuffix(awayRank, locale)}/${standings.length}` : "–",
                noGamesPlayedYet: t("game.noGamesPlayedYet"),
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
              gamesPlayed={(homeStandingsRow?.wins ?? 0) + (homeStandingsRow?.losses ?? 0)}
              labels={{
                record: `${homeStandingsRow?.wins ?? 0}-${homeStandingsRow?.losses ?? 0}`,
                rank: homeRank ? `${homeRank}${ordinalSuffix(homeRank, locale)}/${standings.length}` : "–",
                noGamesPlayedYet: t("game.noGamesPlayedYet"),
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
        <div className="mt-6">
          {talks && mySide && talks.side === mySide && (talks.pregame || talks.halftime) && (
            <section className="card mb-4 p-4 text-sm">
              <p className="eyebrow mb-2">{t("talks.summaryHeading")}</p>
              <ul className="space-y-1">
                {[
                  { label: t("talks.pregameReaction"), outcome: talks.pregame },
                  { label: t("talks.halftimeReaction"), outcome: talks.halftime },
                ]
                  .filter((row) => row.outcome)
                  .map((row) => (
                    <li key={row.label}>
                      <span className="text-muted">{row.label} ({t(`talks.tone.${row.outcome!.tone}` as DictionaryKey)}) : </span>
                      <span className={row.outcome!.focus > 0 ? "text-good" : row.outcome!.focus < 0 ? "text-bad" : ""}>
                        {t(`talks.reaction.${row.outcome!.reaction}` as DictionaryKey)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <GameLeaders
              entries={boxScoreWithNames}
              teams={[awayTeam, homeTeam]}
              labels={{
                heading: t("game.leaders"),
                points: t("game.leader.points"),
                rebounds: t("game.leader.rebounds"),
                assists: t("game.leader.assists"),
              }}
            />
            {dayResults}
          </div>
          <h2 className="mb-3 mt-8 text-lg font-semibold">{t("game.boxScoreHeading")}</h2>
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

// 5 derniers résultats d'une équipe dans la même compétition, avant ce
// match (du plus récent au plus ancien).
async function recentForm(careerId: string, season: string, teamId: string, before: Date): Promise<("W" | "L")[]> {
  const rows = await prisma.game.findMany({
    where: {
      careerId,
      season,
      status: "final",
      gameDate: { lt: before },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "desc" },
    take: 5,
    select: { homeTeamId: true, homeScore: true, awayScore: true },
  });
  return rows.map((g) => {
    const isHome = g.homeTeamId === teamId;
    const mine = (isHome ? g.homeScore : g.awayScore) ?? 0;
    const theirs = (isHome ? g.awayScore : g.homeScore) ?? 0;
    return mine > theirs ? "W" : "L";
  });
}

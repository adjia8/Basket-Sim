import type { StandingsRow } from "@/lib/types";
import { getScheduleForCareer } from "./schedule";
import { getTeamsByLeague } from "./teams";

export async function getStandings(
  careerId: string,
  leagueId: string,
  season: string
): Promise<StandingsRow[]> {
  const [leagueTeams, leagueGames] = await Promise.all([
    getTeamsByLeague(leagueId),
    getScheduleForCareer(careerId, season),
  ]);

  const rows = new Map<string, StandingsRow>();
  for (const team of leagueTeams) {
    rows.set(team.id, {
      teamId: team.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: "-",
    });
  }

  const resultsByTeam = new Map<string, ("W" | "L")[]>();

  for (const game of leagueGames) {
    if (
      game.status !== "final" ||
      game.homeScore === undefined ||
      game.awayScore === undefined
    ) {
      continue;
    }

    const home = rows.get(game.homeTeamId);
    const away = rows.get(game.awayTeamId);
    if (!home || !away) continue;

    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;

    const homeWon = game.homeScore > game.awayScore;
    if (homeWon) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }

    pushResult(resultsByTeam, game.homeTeamId, homeWon ? "W" : "L");
    pushResult(resultsByTeam, game.awayTeamId, homeWon ? "L" : "W");
  }

  for (const [teamId, results] of resultsByTeam) {
    const row = rows.get(teamId);
    if (row) row.streak = computeStreak(results);
  }

  return Array.from(rows.values()).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses
  );
}

function pushResult(
  map: Map<string, ("W" | "L")[]>,
  teamId: string,
  result: "W" | "L"
) {
  const list = map.get(teamId) ?? [];
  list.push(result);
  map.set(teamId, list);
}

function computeStreak(results: ("W" | "L")[]): string {
  if (results.length === 0) return "-";
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === last) count++;
    else break;
  }
  return `${last}${count}`;
}

import Link from "next/link";
import type { ReactNode } from "react";
import type { BoxScoreEntry, Game, Player, StandingsRow, Team } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";
import { playerHref, teamFullName } from "@/lib/utils";

// Écran de match façon Football Manager : tableau de score, face-à-face
// d'avant-match, leaders du match et autres résultats de la journée.

export interface TeamSnapshot {
  team: Team;
  row: StandingsRow | undefined;
  rank: number; // 0 = inconnu
  leagueSize: number;
  form: ("W" | "L")[]; // du plus récent au plus ancien
  injured: Player[];
}

function recordOf(row: StandingsRow | undefined): string {
  return `${row?.wins ?? 0}-${row?.losses ?? 0}`;
}

function perGame(total: number | undefined, row: StandingsRow | undefined): number | null {
  const games = (row?.wins ?? 0) + (row?.losses ?? 0);
  return games > 0 && total !== undefined ? total / games : null;
}

export function Scoreboard({
  away,
  home,
  awayScore,
  homeScore,
  isFinal,
  phaseLabel,
  statusLabel,
  dateLabel,
  rankLabel,
}: {
  away: TeamSnapshot;
  home: TeamSnapshot;
  awayScore?: number;
  homeScore?: number;
  isFinal: boolean;
  phaseLabel: string;
  statusLabel: string;
  dateLabel: string;
  rankLabel: (rank: number, size: number) => string;
}) {
  const awayWon = isFinal && (awayScore ?? 0) > (homeScore ?? 0);
  const homeWon = isFinal && (homeScore ?? 0) > (awayScore ?? 0);
  const side = (snap: TeamSnapshot, score: number | undefined, won: boolean, lost: boolean, alignRight: boolean) => (
    <div className={`flex flex-1 items-center gap-4 ${alignRight ? "flex-row-reverse text-right" : ""}`}>
      <div className="min-w-0">
        <Link
          href={`/teams/${snap.team.id}`}
          className={`block truncate text-lg font-bold hover:underline sm:text-xl ${lost ? "text-muted" : ""}`}
        >
          {teamFullName(snap.team)}
        </Link>
        <p className="text-xs text-muted tabular">
          {recordOf(snap.row)}
          {snap.rank > 0 && ` · ${rankLabel(snap.rank, snap.leagueSize)}`}
        </p>
      </div>
      <span
        className={`ml-auto text-4xl font-extrabold tabular sm:text-5xl ${alignRight ? "ml-0 mr-auto" : ""} ${
          lost ? "text-muted" : won ? "text-fg" : "text-soft"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );

  return (
    <div className="relative overflow-hidden card">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(90deg, ${away.team.primaryColor} 0%, transparent 45%, transparent 55%, ${home.team.primaryColor} 100%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-2 border-b border-line px-5 py-2 text-xs">
        <span className="eyebrow">{phaseLabel}</span>
        <span className="text-muted first-letter:uppercase">{dateLabel}</span>
        <span className={`eyebrow ${isFinal ? "text-fg" : "text-accent-text"}`}>{statusLabel}</span>
      </div>
      <div className="relative flex items-center gap-4 px-5 py-6">
        {side(away, awayScore, awayWon, homeWon, false)}
        <span className="text-sm font-semibold text-faint">@</span>
        {side(home, homeScore, homeWon, awayWon, true)}
      </div>
    </div>
  );
}

// Face-à-face d'avant-match : chaque ligne met en avant le meilleur côté.
export function PreMatchComparison({
  away,
  home,
  labels,
  locale,
}: {
  away: TeamSnapshot;
  home: TeamSnapshot;
  labels: {
    heading: string;
    record: string;
    rank: string;
    form: string;
    pointsFor: string;
    pointsAgainst: string;
    injured: string;
    none: string;
  };
  locale: Locale;
}) {
  const fmt = (v: number | null) =>
    v === null ? "–" : v.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 });
  const winPct = (s: TeamSnapshot) => {
    const g = (s.row?.wins ?? 0) + (s.row?.losses ?? 0);
    return g ? (s.row?.wins ?? 0) / g : null;
  };
  const better = (a: number | null, b: number | null, higherIsBetter = true): "away" | "home" | null => {
    if (a === null || b === null || a === b) return null;
    return (a > b) === higherIsBetter ? "away" : "home";
  };
  const awayPf = perGame(away.row?.pointsFor, away.row);
  const homePf = perGame(home.row?.pointsFor, home.row);
  const awayPa = perGame(away.row?.pointsAgainst, away.row);
  const homePa = perGame(home.row?.pointsAgainst, home.row);

  const formView = (form: ("W" | "L")[]) =>
    form.length === 0 ? (
      <span className="text-faint">–</span>
    ) : (
      <span className="inline-flex gap-1">
        {form.map((r, i) => (
          <span
            key={i}
            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
              r === "W" ? "bg-good/20 text-good" : "bg-bad/20 text-bad"
            }`}
          >
            {r === "W" ? (locale === "fr" ? "V" : "W") : locale === "fr" ? "D" : "L"}
          </span>
        ))}
      </span>
    );
  const injuredView = (players: Player[], teamId: string) =>
    players.length === 0 ? (
      <span className="text-faint">{labels.none}</span>
    ) : (
      <span className="flex flex-col gap-0.5">
        {players.map((p) => (
          <Link key={p.id} href={playerHref(p.id, teamId)} className="text-bad hover:underline">
            {p.firstName} {p.lastName} ({p.injuryGamesRemaining})
          </Link>
        ))}
      </span>
    );

  const rows: { label: string; away: ReactNode; home: ReactNode; best: "away" | "home" | null }[] = [
    { label: labels.record, away: recordOf(away.row), home: recordOf(home.row), best: better(winPct(away), winPct(home)) },
    {
      label: labels.rank,
      away: away.rank || "–",
      home: home.rank || "–",
      best: better(away.rank || null, home.rank || null, false),
    },
    { label: labels.form, away: formView(away.form), home: formView(home.form), best: null },
    { label: labels.pointsFor, away: fmt(awayPf), home: fmt(homePf), best: better(awayPf, homePf) },
    { label: labels.pointsAgainst, away: fmt(awayPa), home: fmt(homePa), best: better(awayPa, homePa, false) },
    {
      label: labels.injured,
      away: injuredView(away.injured, away.team.id),
      home: injuredView(home.injured, home.team.id),
      best: null,
    },
  ];

  return (
    <section className="card p-4">
      <h2 className="eyebrow mb-3">{labels.heading}</h2>
      <div className="divide-y divide-line-soft text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
            <div className={`text-left tabular ${row.best === "away" ? "font-semibold text-good" : ""}`}>{row.away}</div>
            <div className="eyebrow text-center">{row.label}</div>
            <div className={`flex justify-end text-right tabular ${row.best === "home" ? "font-semibold text-good" : ""}`}>
              {row.home}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type NamedEntry = BoxScoreEntry & { player?: Player | undefined };

// Meilleurs joueurs du match par équipe (points, rebonds, passes).
export function GameLeaders({
  entries,
  teams,
  labels,
}: {
  entries: NamedEntry[];
  teams: Team[];
  labels: { heading: string; points: string; rebounds: string; assists: string };
}) {
  const stats: { key: "points" | "rebounds" | "assists"; label: string }[] = [
    { key: "points", label: labels.points },
    { key: "rebounds", label: labels.rebounds },
    { key: "assists", label: labels.assists },
  ];
  return (
    <section className="card p-4">
      <h2 className="eyebrow mb-3">{labels.heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => {
          const own = entries.filter((e) => e.teamId === team.id);
          return (
            <div key={team.id}>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.primaryColor }} aria-hidden />
                {teamFullName(team)}
              </p>
              <ul className="space-y-1 text-sm">
                {stats.map(({ key, label }) => {
                  const best = own.reduce<NamedEntry | null>((m, e) => (!m || e[key] > m[key] ? e : m), null);
                  return (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className="eyebrow">{label}</span>
                      {best?.player ? (
                        <span className="truncate">
                          <Link href={playerHref(best.playerId, team.id)} className="hover:underline">
                            {best.player.firstName} {best.player.lastName}
                          </Link>{" "}
                          <span className="font-bold tabular">{best[key]}</span>
                        </span>
                      ) : (
                        <span className="text-faint">–</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Autres matchs de la même journée, avec leurs scores (ou « à venir »).
export function DayResults({
  games,
  teamById,
  myTeamId,
  labels,
}: {
  games: Game[];
  teamById: Map<string, Team>;
  myTeamId: string;
  labels: { heading: string; none: string; upcoming: string };
}) {
  return (
    <section className="card p-4">
      <h2 className="eyebrow mb-3">{labels.heading}</h2>
      {games.length === 0 ? (
        <p className="text-sm text-muted">{labels.none}</p>
      ) : (
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {games.map((g) => {
            const away = teamById.get(g.awayTeamId);
            const home = teamById.get(g.homeTeamId);
            const final = g.status === "final";
            const awayWon = final && (g.awayScore ?? 0) > (g.homeScore ?? 0);
            const mine = g.homeTeamId === myTeamId || g.awayTeamId === myTeamId;
            const line = (team: Team | undefined, score: number | undefined, won: boolean) => (
              <span className={`flex items-center justify-between gap-2 ${final && !won ? "text-muted" : ""}`}>
                <span className="truncate">{team ? `${team.city} ${team.name}` : "?"}</span>
                <span className={`tabular ${won ? "font-bold" : ""}`}>{final ? score : ""}</span>
              </span>
            );
            return (
              <li key={g.id} className="border-b border-line-soft last:border-0 sm:[&:nth-last-child(2)]:border-0">
                <Link
                  href={`/game/${g.id}`}
                  className={`block rounded px-2 py-2 text-sm transition hover:bg-surface-2 ${mine ? "bg-accent/10" : ""}`}
                >
                  {line(away, g.awayScore, awayWon)}
                  {line(home, g.homeScore, final && !awayWon)}
                  {!final && <span className="text-xs text-accent-text">{labels.upcoming}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

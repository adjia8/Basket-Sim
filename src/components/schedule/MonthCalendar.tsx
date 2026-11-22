import Link from "next/link";
import { monthKey } from "@/lib/careers/month-grid";

// Calendrier mensuel des matchs de mon équipe : une ligne par semaine, du
// lundi au dimanche (voir month-grid.ts). Textes déjà traduits par la page.
export interface CalendarGame {
  id: string;
  opponent: string; // abréviation
  home: boolean;
  played: boolean;
  won: boolean;
  score: string | null; // « 112-104 » (mon score d'abord)
  cup: boolean;
}

export function MonthCalendar({
  month,
  weeks,
  gamesByDay,
  today,
  breakDays,
  weekdayLabels,
  monthLabel,
  prevHref,
  nextHref,
  labels,
}: {
  month: string; // « AAAA-MM »
  weeks: string[][];
  gamesByDay: Map<string, CalendarGame>;
  today: string | null;
  breakDays: Set<string>;
  weekdayLabels: string[]; // lundi → dimanche
  monthLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  labels: { win: string; loss: string; allStar: string; today: string; prev: string; next: string };
}) {
  return (
    <section className="card p-3 sm:p-4" data-testid="month-calendar">
      <div className="mb-3 flex items-center justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-surface-2" aria-label={labels.prev}>
            ‹
          </Link>
        ) : (
          <span className="w-8" />
        )}
        <h2 className="text-base font-semibold first-letter:uppercase">{monthLabel}</h2>
        {nextHref ? (
          <Link href={nextHref} className="rounded-md border border-line px-2.5 py-1 text-sm hover:bg-surface-2" aria-label={labels.next}>
            ›
          </Link>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase tracking-wide text-faint sm:gap-1.5 sm:text-xs">
        {weekdayLabels.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weeks.flat().map((day) => {
          const inMonth = monthKey(day) === month;
          const game = gamesByDay.get(day);
          const isToday = day === today;
          const isBreak = breakDays.has(day);
          const base = `relative flex aspect-square min-w-0 flex-col rounded-md border p-1 text-left sm:p-1.5 ${
            inMonth ? "" : "opacity-35"
          } ${isToday ? "ring-2 ring-accent" : ""}`;
          const dayNumber = (
            <span className={`text-2xs tabular sm:text-xs ${isToday ? "font-bold text-accent-text" : "text-muted"}`}>
              {Number(day.slice(8))}
            </span>
          );
          if (!game) {
            return (
              <div key={day} className={`${base} border-line-soft bg-surface/30`} title={isToday ? labels.today : undefined}>
                {dayNumber}
                {isBreak && <span className="mt-auto truncate text-2xs text-warn sm:text-2xs">⭐ {labels.allStar}</span>}
              </div>
            );
          }
          const tone = !game.played
            ? "border-accent/40 bg-accent/5"
            : game.won
              ? "border-good/40 bg-good/10"
              : "border-bad/40 bg-bad/10";
          return (
            <Link key={day} href={`/game/${game.id}`} className={`${base} ${tone} transition hover:brightness-125`} data-testid="calendar-game">
              <span className="flex items-center justify-between gap-0.5">
                {dayNumber}
                {game.cup && <span className="text-2xs sm:text-2xs">🏆</span>}
              </span>
              <span className="mt-auto truncate text-2xs font-semibold leading-tight sm:text-sm">
                {/* Sur mobile, seul « @ » (extérieur) est affiché : la place manque. */}
                <span className="font-normal text-faint">{game.home ? <span className="hidden sm:inline">vs </span> : "@"}</span>
                {game.opponent}
              </span>
              {game.played && game.score && (
                <span className={`truncate text-2xs font-semibold tabular leading-tight sm:text-xs ${game.won ? "text-good" : "text-bad"}`}>
                  {game.won ? labels.win : labels.loss} <span className="hidden sm:inline">{game.score}</span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

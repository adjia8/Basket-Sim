import "server-only";
import { prisma } from "@/lib/prisma";
import { TRADE_DEADLINE_SEASON_FRACTION } from "@/lib/careers/trade-rules";
import { calendarDay, nbaTradeDeadline } from "@/lib/careers/schedule-rules";
import { getScheduleForCareer } from "./schedule";

export interface TradeDeadlineInfo {
  // Date fixe (NBA) ; null en WNBA, où la limite reste une fraction de la
  // saison (TRADE_DEADLINE_SEASON_FRACTION).
  deadline: Date | null;
  passed: boolean;
  // Jours restants dans le calendrier du jeu, comptés depuis le dernier
  // match joué (ou le 1er match à venir si la saison n'a pas commencé).
  daysLeft: number | null;
}

// NBA : la date limite est dépassée dès qu'un match de saison régulière
// daté APRÈS elle a été joué — l'horloge du jeu n'avance qu'au fil des
// matchs simulés. Se réinitialise naturellement à la saison suivante
// (nouveau calendrier, nouvelle date), pas besoin d'état séparé.
export async function getTradeDeadlineInfo(careerId: string, season: string): Promise<TradeDeadlineInfo> {
  const [career, games] = await Promise.all([
    prisma.career.findUnique({ where: { id: careerId }, select: { leagueId: true } }),
    getScheduleForCareer(careerId, season),
  ]);
  if (games.length === 0) return { deadline: null, passed: false, daysLeft: null };

  if (career?.leagueId !== "nba") {
    const finalCount = games.filter((g) => g.status === "final").length;
    return { deadline: null, passed: finalCount / games.length >= TRADE_DEADLINE_SEASON_FRACTION, daysLeft: null };
  }

  const deadline = nbaTradeDeadline(season);
  const deadlineDay = calendarDay(deadline);
  const played = games.filter((g) => g.status === "final");
  const lastPlayed = played.at(-1)?.gameDate;
  const passed = played.some((g) => calendarDay(g.gameDate) > deadlineDay);
  // Écart en jours calendaires (pas en heures : les heures des matchs
  // générés varient avec le fuseau/l'heure d'été du serveur).
  const reference = lastPlayed ?? games[0].gameDate;
  const daysLeft = Math.max(
    0,
    Math.round((Date.parse(deadlineDay) - Date.parse(calendarDay(reference))) / 86_400_000)
  );
  return { deadline, passed, daysLeft };
}

export async function isTradeDeadlinePassed(careerId: string, season: string): Promise<boolean> {
  return (await getTradeDeadlineInfo(careerId, season)).passed;
}

// La free agency n'ouvre qu'une fois le draft de la saison entièrement résolu
// (plus aucun pick "pending") — comme en vraie NBA où les signatures
// n'ouvrent qu'après le draft. Une saison qui n'a pas encore de draft du tout
// (ex: toute première saison d'une carrière) est considérée ouverte : rien
// ne bloque, il n'y a simplement rien à drafter avant la première.
export async function isFreeAgencyOpen(careerId: string, season: string): Promise<boolean> {
  const pendingPicks = await prisma.draftPick.count({
    where: { careerId, season, status: "pending" },
  });
  return pendingPicks === 0;
}

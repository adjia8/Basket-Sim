import "server-only";
import { prisma } from "@/lib/prisma";
import { TRADE_DEADLINE_SEASON_FRACTION } from "@/lib/careers/trade-rules";
import { getScheduleForCareer } from "./schedule";

// Date limite des échanges dépassée = la fraction de matchs déjà joués cette
// saison a atteint le seuil. Se réinitialise naturellement à la saison
// suivante (nouveau calendrier, nouveau décompte), pas besoin d'état séparé.
export async function isTradeDeadlinePassed(careerId: string, season: string): Promise<boolean> {
  const games = await getScheduleForCareer(careerId, season);
  if (games.length === 0) return false;
  const finalCount = games.filter((g) => g.status === "final").length;
  return finalCount / games.length >= TRADE_DEADLINE_SEASON_FRACTION;
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

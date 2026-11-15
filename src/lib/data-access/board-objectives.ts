import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { winPctForStandings } from "@/lib/careers/player-demands";
import {
  APPROVAL_IF_FAILED,
  APPROVAL_IF_MET,
  BOARD_OBJECTIVES_AFTER_GAMES,
  YOUTH_AGE,
  chooseBoardObjectives,
  objectiveMet,
  parseBoardObjectives,
  type BoardObjective,
  type BoardObjectives,
} from "@/lib/careers/board-objectives-rules";
import type { Locale } from "@/lib/i18n/locale";

export interface ObjectiveProgress extends BoardObjective {
  actual: number;
}

// Valeur actuelle de chaque objectif pour une équipe.
async function measure(
  careerId: string,
  leagueId: string,
  season: string,
  teamId: string
): Promise<{ winPct: number; games: number; youthShare: number; attendance: number; youngPlayers: number }> {
  const [standings, teamState, contracts, stats] = await Promise.all([
    getStandings(careerId, leagueId, season),
    getOrCreateTeamState(careerId, teamId, leagueId),
    prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } }),
    prisma.playerSeasonStat.findMany({ where: { careerId, season, teamId }, select: { playerId: true, minutes: true } }),
  ]);
  const row = standings.find((r) => r.teamId === teamId);
  const ages = new Map(
    (
      await prisma.playerState.findMany({
        where: { careerId, playerId: { in: [...new Set([...contracts.map((c) => c.playerId), ...stats.map((s) => s.playerId)])] } },
        select: { playerId: true, age: true },
      })
    ).map((s) => [s.playerId, s.age])
  );
  const total = stats.reduce((s, r) => s + r.minutes, 0);
  const young = stats.filter((r) => (ages.get(r.playerId) ?? 99) <= YOUTH_AGE).reduce((s, r) => s + r.minutes, 0);
  return {
    winPct: winPctForStandings(row?.wins ?? 0, row?.losses ?? 0),
    games: (row?.wins ?? 0) + (row?.losses ?? 0),
    youthShare: total > 0 ? young / total : 0,
    attendance: teamState.attendance,
    youngPlayers: contracts.filter((c) => (ages.get(c.playerId) ?? 99) <= YOUTH_AGE).length,
  };
}

function actualFor(o: BoardObjective, m: Awaited<ReturnType<typeof measure>>): number {
  return o.type === "win_pct" ? m.winPct : o.type === "develop_youth" ? m.youthShare : m.attendance;
}

function describe(o: BoardObjective, locale: Locale): string {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  if (locale === "fr") {
    if (o.type === "win_pct") return `finir la saison régulière à au moins ${pct(o.target)} de victoires`;
    if (o.type === "develop_youth") return `donner au moins ${pct(o.target)} des minutes aux joueurs de ${YOUTH_AGE} ans et moins`;
    return `porter l'affluence à au moins ${o.target}/99`;
  }
  if (o.type === "win_pct") return `finish the regular season with at least a ${pct(o.target)} win rate`;
  if (o.type === "develop_youth") return `give at least ${pct(o.target)} of the minutes to players aged ${YOUTH_AGE} or under`;
  return `raise attendance to at least ${o.target}/99`;
}

// Fixe les objectifs après BOARD_OBJECTIVES_AFTER_GAMES matchs, puis les
// juge quand la saison régulière est terminée. Pour chaque GM humain.
export async function maybeBoardObjectives(careerId: string, leagueId: string, season: string, locale: Locale): Promise<void> {
  if (!/^\d{4}-\d{4}$/.test(season)) return;
  const [members, total, finals] = await Promise.all([
    prisma.membership.findMany({ where: { careerId }, include: { gmProfile: true } }),
    prisma.game.count({ where: { careerId, season } }),
    prisma.game.count({ where: { careerId, season, status: "final" } }),
  ]);
  const seasonOver = total > 0 && finals === total;
  for (const member of members) {
    const gm = member.gmProfile;
    if (!gm) continue;
    const current = parseBoardObjectives(gm.boardObjectivesJson);
    if (!current || current.season !== season) {
      const m = await measure(careerId, leagueId, season, member.teamId);
      if (m.games < BOARD_OBJECTIVES_AFTER_GAMES || seasonOver) continue;
      const next: BoardObjectives = { season, objectives: chooseBoardObjectives(m) };
      const saved = await prisma.gmProfile.updateMany({
        where: { id: gm.id, boardObjectivesJson: gm.boardObjectivesJson },
        data: { boardObjectivesJson: JSON.stringify(next) },
      });
      if (saved.count === 0) continue;
      const list = next.objectives.map((o) => `• ${describe(o, locale)}`).join("\n");
      await createInboxMessage(
        careerId,
        member.teamId,
        season,
        "board",
        locale === "fr" ? "Les propriétaires fixent leurs objectifs" : "Ownership sets its goals",
        locale === "fr"
          ? `Après ${m.games} matchs, la direction attend de toi d'ici la fin de la saison régulière :\n${list}\nChaque objectif tenu renforce sa confiance, chaque objectif manqué l'entame.`
          : `After ${m.games} games, ownership expects the following by the end of the regular season:\n${list}\nEach goal met builds their trust, each one missed erodes it.`,
        "/gm"
      );
      continue;
    }
    if (!seasonOver || current.objectives.every((o) => o.status !== "active")) continue;
    // Fin de saison régulière : verdict.
    const m = await measure(careerId, leagueId, season, member.teamId);
    const judged = current.objectives.map((o) => ({ ...o, status: objectiveMet(o, actualFor(o, m)) ? "met" : "failed" }) as BoardObjective);
    const met = judged.filter((o) => o.status === "met").length;
    const delta = met * APPROVAL_IF_MET + (judged.length - met) * APPROVAL_IF_FAILED;
    const saved = await prisma.gmProfile.updateMany({
      where: { id: gm.id, boardObjectivesJson: gm.boardObjectivesJson },
      data: {
        boardObjectivesJson: JSON.stringify({ ...current, objectives: judged }),
        frontOfficeApproval: Math.max(0, Math.min(99, gm.frontOfficeApproval + delta)),
      },
    });
    if (saved.count === 0) continue;
    const lines = judged.map((o) => `${o.status === "met" ? "✓" : "✗"} ${describe(o, locale)}`).join("\n");
    await createInboxMessage(
      careerId,
      member.teamId,
      season,
      "board",
      locale === "fr" ? `Bilan des objectifs : ${met}/${judged.length} tenus` : `Goals review: ${met}/${judged.length} met`,
      locale === "fr"
        ? `${lines}\nConfiance de la direction : ${delta > 0 ? "+" : ""}${delta}.`
        : `${lines}\nOwnership trust: ${delta > 0 ? "+" : ""}${delta}.`,
      "/gm"
    );
  }
}

export async function getBoardObjectivesProgress(
  careerId: string,
  leagueId: string,
  season: string,
  teamId: string,
  json: string | null
): Promise<{ objectives: ObjectiveProgress[]; describe: (o: BoardObjective, locale: Locale) => string } | null> {
  const current = parseBoardObjectives(json);
  if (!current || current.season !== season) return null;
  const m = await measure(careerId, leagueId, season, teamId);
  return { objectives: current.objectives.map((o) => ({ ...o, actual: actualFor(o, m) })), describe };
}

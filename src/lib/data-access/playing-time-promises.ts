import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { clampMorale } from "@/lib/careers/morale-rules";
import {
  EXPECTED_MINUTES,
  PROMISE_GAMES,
  PROMISE_MORALE_BROKEN,
  PROMISE_MORALE_HONORED,
  promiseHonored,
  type PlayerStatus,
} from "@/lib/careers/player-status-rules";
import type { BoxScoreEntry } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";

const STATUS_FR: Record<PlayerStatus, string> = {
  franchise: "joueur franchise",
  star: "star",
  starter: "titulaire",
  rotation: "joueur de rotation",
  prospect: "espoir",
  bench: "fin de banc",
};

export interface PromiseProgress {
  status: PlayerStatus;
  games: number;
  minutesPerGame: number;
}

// Matchs de l'équipe joués depuis la promesse, et minutes du joueur.
export async function getPromiseProgress(
  careerId: string,
  teamId: string,
  playerId: string,
  status: string,
  since: Date
): Promise<PromiseProgress> {
  const games = await prisma.game.findMany({
    where: { careerId, status: "final", gameDate: { gt: since }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { gameDate: "asc" },
    take: PROMISE_GAMES,
    select: { boxScore: true },
  });
  let minutes = 0;
  for (const g of games) {
    const e = (JSON.parse(g.boxScore ?? "[]") as BoxScoreEntry[]).find((x) => x.playerId === playerId);
    minutes += e?.minutesPlayed ?? 0;
  }
  return { status: status as PlayerStatus, games: games.length, minutesPerGame: games.length ? minutes / games.length : 0 };
}

// Après chaque match d'une équipe humaine : juge les promesses arrivées à
// PROMISE_GAMES matchs. Tenue : moral en hausse. Rompue : moral en chute et
// le joueur demande à partir.
export async function evaluatePlayingTimePromises(
  careerId: string,
  teamId: string,
  season: string,
  locale: Locale
): Promise<void> {
  const contracts = await prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } });
  const states = await prisma.playerState.findMany({
    where: { careerId, playerId: { in: contracts.map((c) => c.playerId) }, promisedStatus: { not: null }, promiseSince: { not: null } },
    include: { player: { select: { firstName: true, lastName: true } } },
  });
  for (const s of states) {
    const progress = await getPromiseProgress(careerId, teamId, s.playerId, s.promisedStatus!, s.promiseSince!);
    if (progress.games < PROMISE_GAMES) continue;
    const kept = promiseHonored(progress.minutesPerGame, progress.status);
    const name = `${s.player.firstName} ${s.player.lastName}`;
    const updated = await prisma.playerState.updateMany({
      where: { id: s.id, promisedStatus: s.promisedStatus },
      data: {
        promisedStatus: null,
        promiseSince: null,
        morale: clampMorale(s.morale + (kept ? PROMISE_MORALE_HONORED : PROMISE_MORALE_BROKEN)),
        ...(kept
          ? {}
          : { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(["morale"]), tradeRequestSinceSeason: season }),
      },
    });
    if (updated.count === 0) continue;
    const label = locale === "fr" ? STATUS_FR[progress.status] : progress.status;
    const mpg = progress.minutesPerGame.toFixed(1);
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_reaction",
      kept
        ? locale === "fr" ? `${name} : promesse tenue` : `${name}: promise kept`
        : locale === "fr" ? `${name} : promesse rompue` : `${name}: promise broken`,
      kept
        ? locale === "fr"
          ? `Tu lui avais promis un rôle de ${label} : ${mpg} min par match sur les ${PROMISE_GAMES} derniers matchs. Il est ravi.`
          : `You promised him a ${label} role: ${mpg} min per game over the last ${PROMISE_GAMES} games. He's delighted.`
        : locale === "fr"
          ? `Tu lui avais promis un rôle de ${label} (≈ ${EXPECTED_MINUTES[progress.status]} min), il n'a joué que ${mpg} min par match. Il se sent trahi et demande à partir.`
          : `You promised him a ${label} role (≈ ${EXPECTED_MINUTES[progress.status]} min); he only played ${mpg} min per game. He feels betrayed and wants out.`,
      `/teams/${teamId}/players/${s.playerId}`,
      { playerId: s.playerId }
    );
  }
}

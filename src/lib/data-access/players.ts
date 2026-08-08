import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { toDomainPlayer, toDomainPlayerWithState } from "./mappers";

export async function getAllPlayers(): Promise<Player[]> {
  const rows = await prisma.player.findMany();
  return rows.map(toDomainPlayer);
}

// Le roster "actuel" d'une équipe est déterminé par les Contract de cette
// Career (pas le catalogue global Player.teamId), et l'âge/les ratings
// affichés viennent du PlayerState de cette Career (pas les valeurs figées du
// catalogue) — c'est ce qui permet aux agents libres/signatures/vieillissement
// de fonctionner indépendamment d'une Career à l'autre.
export async function getRosterForTeam(
  careerId: string,
  teamId: string
): Promise<Player[]> {
  const contracts = await prisma.contract.findMany({
    where: { careerId, teamId },
    include: {
      player: { include: { playerStates: { where: { careerId } } } },
    },
  });
  return contracts.map((c) =>
    toDomainPlayerWithState(c.player, c.player.playerStates[0])
  );
}

export async function getPlayerById(playerId: string): Promise<Player | undefined> {
  const row = await prisma.player.findUnique({ where: { id: playerId } });
  return row ? toDomainPlayer(row) : undefined;
}

// Même principe que getRosterForTeam mais pour un seul joueur (fiche détail) :
// bio fixe du catalogue + état par-Career (âge/ratings actuels) superposé.
export async function getPlayerWithState(
  careerId: string,
  playerId: string
): Promise<Player | undefined> {
  const row = await prisma.player.findUnique({
    where: { id: playerId },
    include: { playerStates: { where: { careerId } } },
  });
  return row ? toDomainPlayerWithState(row, row.playerStates[0]) : undefined;
}

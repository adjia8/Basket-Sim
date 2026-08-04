"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
} from "@/lib/careers/roster-rules";
import { TRADE_ACCEPT_TOLERANCE, tradeValue } from "@/lib/careers/trade-rules";

export interface TradeFormState {
  error?: string;
  success?: string;
}

export async function proposeTrade(
  _prevState: TradeFormState | undefined,
  formData: FormData
): Promise<TradeFormState> {
  const { userId } = await verifySession();
  const opponentTeamId = String(formData.get("opponentTeamId") ?? "");
  const myPlayerIds = formData.getAll("myPlayerIds").map(String);
  const theirPlayerIds = formData.getAll("theirPlayerIds").map(String);

  const career = await prisma.career.findUnique({ where: { userId } });
  if (!career) return { error: "Aucune carrière." };

  if (myPlayerIds.length === 0 || theirPlayerIds.length === 0) {
    return { error: "Sélectionne au moins un joueur de chaque côté." };
  }

  const opponentTeam = await prisma.team.findUnique({
    where: { id: opponentTeamId },
  });
  if (
    !opponentTeam ||
    opponentTeam.leagueId !== career.leagueId ||
    opponentTeamId === career.teamId
  ) {
    return { error: "Équipe adverse invalide." };
  }

  const [myContracts, theirContracts] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: career.id, playerId: { in: myPlayerIds } },
      include: { player: true },
    }),
    prisma.contract.findMany({
      where: { careerId: career.id, playerId: { in: theirPlayerIds } },
      include: { player: true },
    }),
  ]);

  const myValid =
    myContracts.length === myPlayerIds.length &&
    myContracts.every((c) => c.teamId === career.teamId);
  const theirValid =
    theirContracts.length === theirPlayerIds.length &&
    theirContracts.every((c) => c.teamId === opponentTeamId);
  if (!myValid || !theirValid) {
    return { error: "Sélection invalide." };
  }

  const [myRosterSize, theirRosterSize] = await Promise.all([
    prisma.contract.count({
      where: { careerId: career.id, teamId: career.teamId },
    }),
    prisma.contract.count({
      where: { careerId: career.id, teamId: opponentTeamId },
    }),
  ]);
  const myNewSize = myRosterSize - myPlayerIds.length + theirPlayerIds.length;
  const theirNewSize = theirRosterSize - theirPlayerIds.length + myPlayerIds.length;
  if (
    myNewSize < MIN_ROSTER_SIZE ||
    myNewSize > MAX_ROSTER_SIZE ||
    theirNewSize < MIN_ROSTER_SIZE ||
    theirNewSize > MAX_ROSTER_SIZE
  ) {
    return {
      error: `Cet échange ferait sortir un effectif de la fourchette ${MIN_ROSTER_SIZE}-${MAX_ROSTER_SIZE} joueurs.`,
    };
  }

  const valueGivenByAi = theirContracts.reduce(
    (sum, c) => sum + tradeValue(c.player.overallRating),
    0
  );
  const valueReceivedByAi = myContracts.reduce(
    (sum, c) => sum + tradeValue(c.player.overallRating),
    0
  );
  if (valueReceivedByAi < valueGivenByAi * TRADE_ACCEPT_TOLERANCE) {
    return { error: "L'IA refuse : échange trop déséquilibré en ta faveur." };
  }

  await prisma.$transaction([
    ...myPlayerIds.map((playerId) =>
      prisma.contract.update({
        where: { careerId_playerId: { careerId: career.id, playerId } },
        data: { teamId: opponentTeamId },
      })
    ),
    ...theirPlayerIds.map((playerId) =>
      prisma.contract.update({
        where: { careerId_playerId: { careerId: career.id, playerId } },
        data: { teamId: career.teamId },
      })
    ),
  ]);

  revalidatePath("/");
  revalidatePath(`/teams/${career.teamId}`);
  revalidatePath(`/teams/${opponentTeamId}`);

  return { success: "Échange accepté !" };
}

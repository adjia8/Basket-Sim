"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
} from "@/lib/careers/roster-rules";
import { TRADE_ACCEPT_TOLERANCE, tradeValue } from "@/lib/careers/trade-rules";
import { formatSalary } from "@/lib/utils";

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

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: "Aucune carrière." };

  if (myPlayerIds.length === 0 || theirPlayerIds.length === 0) {
    return { error: "Sélectionne au moins un joueur de chaque côté." };
  }

  const opponentTeam = await prisma.team.findUnique({
    where: { id: opponentTeamId },
  });
  if (
    !opponentTeam ||
    opponentTeam.leagueId !== membership.career.leagueId ||
    opponentTeamId === membership.teamId
  ) {
    return { error: "Équipe adverse invalide." };
  }

  const [myContracts, theirContracts] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: myPlayerIds } },
      include: { player: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: theirPlayerIds } },
      include: { player: true },
    }),
  ]);

  const myValid =
    myContracts.length === myPlayerIds.length &&
    myContracts.every((c) => c.teamId === membership.teamId);
  const theirValid =
    theirContracts.length === theirPlayerIds.length &&
    theirContracts.every((c) => c.teamId === opponentTeamId);
  if (!myValid || !theirValid) {
    return { error: "Sélection invalide." };
  }

  const [myAllContracts, theirAllContracts, league] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: membership.teamId },
      select: { salary: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: opponentTeamId },
      select: { salary: true },
    }),
    getLeagueById(membership.career.leagueId),
  ]);
  const myNewSize = myAllContracts.length - myPlayerIds.length + theirPlayerIds.length;
  const theirNewSize = theirAllContracts.length - theirPlayerIds.length + myPlayerIds.length;
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

  const salaryCap = league?.salaryCap ?? Infinity;
  const mySalaryOut = myContracts.reduce((sum, c) => sum + c.salary, 0);
  const theirSalaryOut = theirContracts.reduce((sum, c) => sum + c.salary, 0);
  const myCurrentPayroll = myAllContracts.reduce((sum, c) => sum + c.salary, 0);
  const theirCurrentPayroll = theirAllContracts.reduce((sum, c) => sum + c.salary, 0);
  const myNewPayroll = myCurrentPayroll - mySalaryOut + theirSalaryOut;
  const theirNewPayroll = theirCurrentPayroll - theirSalaryOut + mySalaryOut;
  if (myNewPayroll > salaryCap || theirNewPayroll > salaryCap) {
    return {
      error: `Cet échange ferait dépasser le plafond salarial (${formatSalary(salaryCap)}) pour l'une des deux équipes.`,
    };
  }

  const opponentManager = await getMembershipForTeam(membership.careerId, opponentTeamId);

  if (!opponentManager) {
    // Adversaire IA : comportement inchangé, heuristique de tolérance + exécution immédiate.
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
          where: { careerId_playerId: { careerId: membership.careerId, playerId } },
          data: { teamId: opponentTeamId },
        })
      ),
      ...theirPlayerIds.map((playerId) =>
        prisma.contract.update({
          where: { careerId_playerId: { careerId: membership.careerId, playerId } },
          data: { teamId: membership.teamId },
        })
      ),
    ]);

    revalidatePath("/");
    revalidatePath(`/teams/${membership.teamId}`);
    revalidatePath(`/teams/${opponentTeamId}`);

    return { success: "Échange accepté !" };
  }

  // Adversaire humain : l'échange doit être confirmé par lui, pas exécuté immédiatement.
  await prisma.tradeOffer.create({
    data: {
      careerId: membership.careerId,
      fromTeamId: membership.teamId,
      toTeamId: opponentTeamId,
      items: {
        create: [
          ...myPlayerIds.map((playerId) => ({ playerId, side: "from" })),
          ...theirPlayerIds.map((playerId) => ({ playerId, side: "to" })),
        ],
      },
    },
  });

  revalidatePath("/trades");
  return { success: `Proposition envoyée à ${opponentManager.email}, en attente de réponse.` };
}

export async function respondToTradeOffer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const tradeOfferId = String(formData.get("tradeOfferId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: tradeOfferId },
    include: { items: true },
  });
  if (!offer || offer.careerId !== membership.careerId) return;
  if (offer.toTeamId !== membership.teamId) return; // seul le destinataire peut répondre
  if (offer.status !== "pending") return;

  if (decision === "reject") {
    await prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "rejected" } });
    revalidatePath("/trades");
    return;
  }
  if (decision !== "accept") return;

  const fromPlayerIds = offer.items.filter((i) => i.side === "from").map((i) => i.playerId);
  const toPlayerIds = offer.items.filter((i) => i.side === "to").map((i) => i.playerId);

  // L'état peut avoir changé depuis la proposition (joueur libéré/échangé
  // entre-temps, effectif désormais plein) : on revérifie tout au moment de
  // l'acceptation plutôt que de faire confiance à l'offre telle que créée.
  const [fromContracts, toContracts, fromTeamContracts, toTeamContracts, league] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: fromPlayerIds } },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: toPlayerIds } },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: offer.fromTeamId },
      select: { salary: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: offer.toTeamId },
      select: { salary: true },
    }),
    getLeagueById(membership.career.leagueId),
  ]);

  const fromValid =
    fromContracts.length === fromPlayerIds.length &&
    fromContracts.every((c) => c.teamId === offer.fromTeamId);
  const toValid =
    toContracts.length === toPlayerIds.length &&
    toContracts.every((c) => c.teamId === offer.toTeamId);
  const newFromSize = fromTeamContracts.length - fromPlayerIds.length + toPlayerIds.length;
  const newToSize = toTeamContracts.length - toPlayerIds.length + fromPlayerIds.length;

  const salaryCap = league?.salaryCap ?? Infinity;
  const fromSalaryOut = fromContracts.reduce((sum, c) => sum + c.salary, 0);
  const toSalaryOut = toContracts.reduce((sum, c) => sum + c.salary, 0);
  const fromCurrentPayroll = fromTeamContracts.reduce((sum, c) => sum + c.salary, 0);
  const toCurrentPayroll = toTeamContracts.reduce((sum, c) => sum + c.salary, 0);
  const fromNewPayroll = fromCurrentPayroll - fromSalaryOut + toSalaryOut;
  const toNewPayroll = toCurrentPayroll - toSalaryOut + fromSalaryOut;

  const stillValid =
    fromValid &&
    toValid &&
    newFromSize >= MIN_ROSTER_SIZE &&
    newFromSize <= MAX_ROSTER_SIZE &&
    newToSize >= MIN_ROSTER_SIZE &&
    newToSize <= MAX_ROSTER_SIZE &&
    fromNewPayroll <= salaryCap &&
    toNewPayroll <= salaryCap;

  if (!stillValid) {
    await prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "cancelled" } });
    revalidatePath("/trades");
    return;
  }

  await prisma.$transaction([
    prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "accepted" } }),
    ...fromPlayerIds.map((playerId) =>
      prisma.contract.update({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
        data: { teamId: offer.toTeamId },
      })
    ),
    ...toPlayerIds.map((playerId) =>
      prisma.contract.update({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
        data: { teamId: offer.fromTeamId },
      })
    ),
  ]);

  revalidatePath("/");
  revalidatePath(`/teams/${offer.fromTeamId}`);
  revalidatePath(`/teams/${offer.toTeamId}`);
  revalidatePath("/trades");
}

export async function cancelTradeOffer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const tradeOfferId = String(formData.get("tradeOfferId") ?? "");

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const offer = await prisma.tradeOffer.findUnique({ where: { id: tradeOfferId } });
  if (!offer || offer.careerId !== membership.careerId) return;
  if (offer.fromTeamId !== membership.teamId) return; // seul l'auteur peut annuler
  if (offer.status !== "pending") return;

  await prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "cancelled" } });
  revalidatePath("/trades");
}

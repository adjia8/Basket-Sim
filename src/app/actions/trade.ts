"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
} from "@/lib/careers/roster-rules";
import { draftPickTradeValue, TRADE_ACCEPT_TOLERANCE, tradeValue } from "@/lib/careers/trade-rules";
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
  const myPickIds = formData.getAll("myPickIds").map(String);
  const theirPickIds = formData.getAll("theirPickIds").map(String);

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: "Aucune carrière." };

  if (await isTradeDeadlinePassed(membership.careerId, membership.career.season)) {
    return { error: "La date limite des échanges est dépassée pour cette saison." };
  }

  if (
    myPlayerIds.length + myPickIds.length === 0 ||
    theirPlayerIds.length + theirPickIds.length === 0
  ) {
    return { error: "Sélectionne au moins un actif de chaque côté." };
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

  const [myContracts, theirContracts, myPicks, theirPicks] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: myPlayerIds } },
      include: { player: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: theirPlayerIds } },
      include: { player: true },
    }),
    prisma.draftPick.findMany({ where: { id: { in: myPickIds } } }),
    prisma.draftPick.findMany({ where: { id: { in: theirPickIds } } }),
  ]);

  const myPlayersValid =
    myContracts.length === myPlayerIds.length &&
    myContracts.every((c) => c.teamId === membership.teamId);
  const theirPlayersValid =
    theirContracts.length === theirPlayerIds.length &&
    theirContracts.every((c) => c.teamId === opponentTeamId);
  const myPicksValid =
    myPicks.length === myPickIds.length &&
    myPicks.every(
      (p) => p.careerId === membership.careerId && p.teamId === membership.teamId && p.status === "pending"
    );
  const theirPicksValid =
    theirPicks.length === theirPickIds.length &&
    theirPicks.every(
      (p) => p.careerId === membership.careerId && p.teamId === opponentTeamId && p.status === "pending"
    );
  if (!myPlayersValid || !theirPlayersValid || !myPicksValid || !theirPicksValid) {
    return { error: "Sélection invalide." };
  }

  const [myRosterSize, theirRosterSize, league, myCurrentPayroll, theirCurrentPayroll] = await Promise.all([
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: opponentTeamId },
    }),
    getLeagueById(membership.career.leagueId),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getPayrollForTeam(membership.careerId, opponentTeamId),
  ]);
  // Les picks n'affectent ni l'effectif ni la masse salariale tant qu'ils
  // n'ont pas été utilisés pour drafter un joueur : seuls les joueurs
  // comptent dans ces deux vérifications.
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

  const salaryCap = league?.salaryCap ?? Infinity;
  const mySalaryOut = myContracts.reduce((sum, c) => sum + c.salary, 0);
  const theirSalaryOut = theirContracts.reduce((sum, c) => sum + c.salary, 0);
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
    const picksPerRound = (await getTeamsByLeague(membership.career.leagueId)).length;
    const valueGivenByAi =
      theirContracts.reduce((sum, c) => sum + tradeValue(c.player.overallRating), 0) +
      theirPicks.reduce((sum, p) => sum + draftPickTradeValue(p.round, p.pickNumber, picksPerRound), 0);
    const valueReceivedByAi =
      myContracts.reduce((sum, c) => sum + tradeValue(c.player.overallRating), 0) +
      myPicks.reduce((sum, p) => sum + draftPickTradeValue(p.round, p.pickNumber, picksPerRound), 0);
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
      ...myPickIds.map((id) =>
        prisma.draftPick.updateMany({ where: { id, status: "pending" }, data: { teamId: opponentTeamId } })
      ),
      ...theirPickIds.map((id) =>
        prisma.draftPick.updateMany({ where: { id, status: "pending" }, data: { teamId: membership.teamId } })
      ),
      ...myPlayerIds.map((playerId) =>
        prisma.playerTeamStint.create({
          data: { careerId: membership.careerId, playerId, teamId: opponentTeamId, season: membership.career.season, reason: "traded" },
        })
      ),
      ...theirPlayerIds.map((playerId) =>
        prisma.playerTeamStint.create({
          data: { careerId: membership.careerId, playerId, teamId: membership.teamId, season: membership.career.season, reason: "traded" },
        })
      ),
    ]);

    revalidatePath("/");
    revalidatePath(`/teams/${membership.teamId}`);
    revalidatePath(`/teams/${opponentTeamId}`);
    revalidatePath("/draft");

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
          ...myPickIds.map((draftPickId) => ({ draftPickId, side: "from" })),
          ...theirPickIds.map((draftPickId) => ({ draftPickId, side: "to" })),
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

  const fromPlayerIds = offer.items.filter((i) => i.side === "from" && i.playerId).map((i) => i.playerId!);
  const toPlayerIds = offer.items.filter((i) => i.side === "to" && i.playerId).map((i) => i.playerId!);
  const fromPickIds = offer.items.filter((i) => i.side === "from" && i.draftPickId).map((i) => i.draftPickId!);
  const toPickIds = offer.items.filter((i) => i.side === "to" && i.draftPickId).map((i) => i.draftPickId!);

  // L'état peut avoir changé depuis la proposition (joueur libéré/échangé,
  // pick déjà utilisé ou échangé ailleurs, effectif désormais plein) : on
  // revérifie tout au moment de l'acceptation plutôt que de faire confiance
  // à l'offre telle que créée.
  const [
    fromContracts,
    toContracts,
    fromPicks,
    toPicks,
    fromRosterSize,
    toRosterSize,
    league,
    fromCurrentPayroll,
    toCurrentPayroll,
    deadlinePassed,
  ] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: fromPlayerIds } },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, playerId: { in: toPlayerIds } },
    }),
    prisma.draftPick.findMany({ where: { id: { in: fromPickIds } } }),
    prisma.draftPick.findMany({ where: { id: { in: toPickIds } } }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: offer.fromTeamId },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: offer.toTeamId },
    }),
    getLeagueById(membership.career.leagueId),
    getPayrollForTeam(membership.careerId, offer.fromTeamId),
    getPayrollForTeam(membership.careerId, offer.toTeamId),
    isTradeDeadlinePassed(membership.careerId, membership.career.season),
  ]);

  const fromPlayersValid =
    fromContracts.length === fromPlayerIds.length &&
    fromContracts.every((c) => c.teamId === offer.fromTeamId);
  const toPlayersValid =
    toContracts.length === toPlayerIds.length &&
    toContracts.every((c) => c.teamId === offer.toTeamId);
  const fromPicksValid =
    fromPicks.length === fromPickIds.length &&
    fromPicks.every((p) => p.teamId === offer.fromTeamId && p.status === "pending");
  const toPicksValid =
    toPicks.length === toPickIds.length &&
    toPicks.every((p) => p.teamId === offer.toTeamId && p.status === "pending");

  const newFromSize = fromRosterSize - fromPlayerIds.length + toPlayerIds.length;
  const newToSize = toRosterSize - toPlayerIds.length + fromPlayerIds.length;

  const salaryCap = league?.salaryCap ?? Infinity;
  const fromSalaryOut = fromContracts.reduce((sum, c) => sum + c.salary, 0);
  const toSalaryOut = toContracts.reduce((sum, c) => sum + c.salary, 0);
  const fromNewPayroll = fromCurrentPayroll - fromSalaryOut + toSalaryOut;
  const toNewPayroll = toCurrentPayroll - toSalaryOut + fromSalaryOut;

  const stillValid =
    !deadlinePassed &&
    fromPlayersValid &&
    toPlayersValid &&
    fromPicksValid &&
    toPicksValid &&
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
    ...fromPickIds.map((id) =>
      prisma.draftPick.updateMany({ where: { id, status: "pending" }, data: { teamId: offer.toTeamId } })
    ),
    ...toPickIds.map((id) =>
      prisma.draftPick.updateMany({ where: { id, status: "pending" }, data: { teamId: offer.fromTeamId } })
    ),
    ...fromPlayerIds.map((playerId) =>
      prisma.playerTeamStint.create({
        data: { careerId: membership.careerId, playerId, teamId: offer.toTeamId, season: membership.career.season, reason: "traded" },
      })
    ),
    ...toPlayerIds.map((playerId) =>
      prisma.playerTeamStint.create({
        data: { careerId: membership.careerId, playerId, teamId: offer.fromTeamId, season: membership.career.season, reason: "traded" },
      })
    ),
  ]);

  revalidatePath("/");
  revalidatePath(`/teams/${offer.fromTeamId}`);
  revalidatePath(`/teams/${offer.toTeamId}`);
  revalidatePath("/trades");
  revalidatePath("/draft");
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

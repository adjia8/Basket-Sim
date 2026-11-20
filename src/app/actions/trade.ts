"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { recordTradeNews } from "@/lib/data-access/league-news";
import { getLocale } from "@/lib/i18n/locale";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getMembershipForTeam } from "@/lib/data-access/memberships";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { checkTradeSide, type CapVerdict } from "@/lib/careers/cap-rules";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
} from "@/lib/careers/roster-rules";
import {
  capSalary,
  evaluateTradeForAi,
  rosterMoveAllowed,
  teamOutlook,
  type TradeAsset,
} from "@/lib/careers/trade-rules";
import { ALT_CONTRACT_SLOTS_PER_TEAM } from "@/lib/careers/contract-type-rules";
import { NBA_TAX_LINE } from "@/lib/careers/cap-rules";
import { getStandings } from "@/lib/data-access/standings";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { getTranslator } from "@/lib/i18n/translate";
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
  const { t, locale } = await getTranslator();
  const opponentTeamId = String(formData.get("opponentTeamId") ?? "");
  const myPlayerIds = formData.getAll("myPlayerIds").map(String);
  const theirPlayerIds = formData.getAll("theirPlayerIds").map(String);
  const myPickIds = formData.getAll("myPickIds").map(String);
  const theirPickIds = formData.getAll("theirPickIds").map(String);

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true },
  });
  if (!membership) return { error: t("tradeAction.noCareer") };

  if (await isTradeDeadlinePassed(membership.careerId, membership.career.season)) {
    return { error: t("tradeAction.deadlinePassed") };
  }

  if (
    myPlayerIds.length + myPickIds.length === 0 ||
    theirPlayerIds.length + theirPickIds.length === 0
  ) {
    return { error: t("tradeAction.selectAtLeastOne") };
  }

  const opponentTeam = await prisma.team.findUnique({
    where: { id: opponentTeamId },
  });
  if (
    !opponentTeam ||
    opponentTeam.leagueId !== membership.career.leagueId ||
    opponentTeamId === membership.teamId
  ) {
    return { error: t("tradeAction.invalidOpponent") };
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
    return { error: t("tradeAction.invalidSelection") };
  }

  const [myRoster, theirRoster, league, myCurrentPayroll, theirCurrentPayroll] = await Promise.all([
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: membership.teamId },
      select: { contractType: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: opponentTeamId },
      select: { contractType: true },
    }),
    getLeagueById(membership.career.leagueId),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getPayrollForTeam(membership.careerId, opponentTeamId),
  ]);
  // Les picks n'affectent ni l'effectif ni la masse salariale tant qu'ils
  // n'ont pas été utilisés pour drafter un joueur : seuls les joueurs
  // comptent dans ces deux vérifications.
  const minRosterSize = MIN_ROSTER_SIZE[membership.career.leagueId] ?? MIN_ROSTER_SIZE.nba;
  const maxRosterSize = MAX_ROSTER_SIZE[membership.career.leagueId] ?? MAX_ROSTER_SIZE.nba;
  // Contrats standard et places two-way contrôlés séparément (voir
  // rosterMoveAllowed) : seuls les standard comptent dans l'effectif.
  const isStd = (c: { contractType: string }) => c.contractType === "standard";
  const altSlots = ALT_CONTRACT_SLOTS_PER_TEAM[membership.career.leagueId] ?? 0;
  const myMoveOk = rosterMoveAllowed(
    {
      standardBefore: myRoster.filter(isStd).length,
      altBefore: myRoster.length - myRoster.filter(isStd).length,
      standardOut: myContracts.filter(isStd).length,
      altOut: myContracts.length - myContracts.filter(isStd).length,
      standardIn: theirContracts.filter(isStd).length,
      altIn: theirContracts.length - theirContracts.filter(isStd).length,
    },
    minRosterSize,
    maxRosterSize,
    altSlots
  );
  const theirMoveOk = rosterMoveAllowed(
    {
      standardBefore: theirRoster.filter(isStd).length,
      altBefore: theirRoster.length - theirRoster.filter(isStd).length,
      standardOut: theirContracts.filter(isStd).length,
      altOut: theirContracts.length - theirContracts.filter(isStd).length,
      standardIn: myContracts.filter(isStd).length,
      altIn: myContracts.length - myContracts.filter(isStd).length,
    },
    minRosterSize,
    maxRosterSize,
    altSlots
  );
  if (!myMoveOk || !theirMoveOk) {
    return {
      error: t("tradeAction.rosterSizeOutOfRange", { min: minRosterSize, max: maxRosterSize }),
    };
  }

  const salaryCap = league?.salaryCap ?? Infinity;
  // Masse salariale : seuls les contrats standard comptent (voir capSalary).
  const mySalaryOut = capSalary(myContracts);
  const theirSalaryOut = capSalary(theirContracts);
  const leagueId = membership.career.leagueId;
  const capVerdict = [
    checkTradeSide(leagueId, salaryCap, myCurrentPayroll, mySalaryOut, theirSalaryOut),
    checkTradeSide(leagueId, salaryCap, theirCurrentPayroll, theirSalaryOut, mySalaryOut),
  ].find((v): v is Exclude<CapVerdict, { ok: true }> => !v.ok);
  if (capVerdict) {
    const limit = formatSalary(capVerdict.limit, locale);
    if (capVerdict.reason === "salary_matching") return { error: t("tradeAction.salaryMatching", { limit }) };
    if (capVerdict.reason === "apron") return { error: t("tradeAction.exceedsApron", { limit }) };
    return { error: t("tradeAction.exceedsCap", { cap: limit }) };
  }

  const opponentManager = await getMembershipForTeam(membership.careerId, opponentTeamId);

  if (!opponentManager) {
    // Adversaire IA : il juge l'échange selon SA situation (voir
    // evaluateTradeForAi) — une équipe en reconstruction recherche jeunes et
    // choix de draft et fuit les gros salaires, une équipe qui joue le titre
    // veut des joueurs utiles tout de suite — d'après la note et l'âge
    // ACTUELS des joueurs dans la carrière.
    const [leagueTeams, states, standings, expectations] = await Promise.all([
      getTeamsByLeague(membership.career.leagueId),
      prisma.playerState.findMany({
        where: { careerId: membership.careerId, playerId: { in: [...myPlayerIds, ...theirPlayerIds] } },
        select: { playerId: true, overallRating: true, age: true },
      }),
      getStandings(membership.careerId, membership.career.leagueId, membership.career.season),
      getCareerExpectations(membership.careerId, membership.career.leagueId),
    ]);
    const stateById = new Map(states.map((st) => [st.playerId, st]));
    const asPlayer = (c: (typeof myContracts)[number]): TradeAsset => {
      const st = stateById.get(c.playerId);
      return {
        kind: "player",
        overall: st?.overallRating ?? c.player.overallRating,
        age: st?.age ?? c.player.age,
        salary: c.salary,
        standard: c.contractType === "standard",
      };
    };
    const asPick = (p: (typeof myPicks)[number]): TradeAsset => ({ kind: "pick", round: p.round, pickNumber: p.pickNumber });
    const row = standings.find((r) => r.teamId === opponentTeamId);
    const outlook = teamOutlook({
      winPct: winPctForStandings(row?.wins ?? 0, row?.losses ?? 0),
      gamesPlayed: (row?.wins ?? 0) + (row?.losses ?? 0),
      expectation: expectations.get(opponentTeamId) ?? null,
    });
    const decision = evaluateTradeForAi({
      outlook,
      received: [...myContracts.map(asPlayer), ...myPicks.map(asPick)],
      given: [...theirContracts.map(asPlayer), ...theirPicks.map(asPick)],
      picksPerRound: leagueTeams.length,
      payrollBefore: theirCurrentPayroll,
      taxLine: leagueId === "nba" ? NBA_TAX_LINE : Infinity,
    });
    if (!decision.accept) {
      const team = `${opponentTeam.city} ${opponentTeam.name}`;
      const key =
        decision.reason === "rebuild"
          ? "tradeAction.aiRefusesRebuild"
          : decision.reason === "contender"
            ? "tradeAction.aiRefusesContender"
            : decision.reason === "salary"
              ? "tradeAction.aiRefusesSalary"
              : "tradeAction.aiRefuses";
      return { error: t(key, { team }) };
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

    await recordTradeNews(
      membership.careerId,
      membership.career.season,
      membership.teamId,
      opponentTeamId,
      theirPlayerIds,
      myPlayerIds,
      locale
    );

    revalidatePath("/");
    revalidatePath(`/teams/${membership.teamId}`);
    revalidatePath(`/teams/${opponentTeamId}`);
    revalidatePath("/draft");

    return { success: t("tradeAction.accepted") };
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
  return { success: t("tradeAction.sentAwaitingResponse", { email: opponentManager.email }) };
}

export async function respondToTradeOffer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const tradeOfferId = String(formData.get("tradeOfferId") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
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
    fromRoster,
    toRoster,
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
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: offer.fromTeamId },
      select: { contractType: true },
    }),
    prisma.contract.findMany({
      where: { careerId: membership.careerId, teamId: offer.toTeamId },
      select: { contractType: true },
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

  const minRosterSize = MIN_ROSTER_SIZE[membership.career.leagueId] ?? MIN_ROSTER_SIZE.nba;
  const maxRosterSize = MAX_ROSTER_SIZE[membership.career.leagueId] ?? MAX_ROSTER_SIZE.nba;
  const altSlots = ALT_CONTRACT_SLOTS_PER_TEAM[membership.career.leagueId] ?? 0;
  const isStd = (c: { contractType: string }) => c.contractType === "standard";
  const moveOk = (roster: { contractType: string }[], out: { contractType: string }[], incoming: { contractType: string }[]) =>
    rosterMoveAllowed(
      {
        standardBefore: roster.filter(isStd).length,
        altBefore: roster.length - roster.filter(isStd).length,
        standardOut: out.filter(isStd).length,
        altOut: out.length - out.filter(isStd).length,
        standardIn: incoming.filter(isStd).length,
        altIn: incoming.length - incoming.filter(isStd).length,
      },
      minRosterSize,
      maxRosterSize,
      altSlots
    );

  const salaryCap = league?.salaryCap ?? Infinity;
  // Seuls les contrats standard comptent dans la masse salariale.
  const fromSalaryOut = capSalary(fromContracts);
  const toSalaryOut = capSalary(toContracts);
  const capOk =
    checkTradeSide(membership.career.leagueId, salaryCap, fromCurrentPayroll, fromSalaryOut, toSalaryOut).ok &&
    checkTradeSide(membership.career.leagueId, salaryCap, toCurrentPayroll, toSalaryOut, fromSalaryOut).ok;
  // Même règle qu'à la proposition (voir rosterMoveAllowed).
  const rosterOk = moveOk(fromRoster, fromContracts, toContracts) && moveOk(toRoster, toContracts, fromContracts);

  const stillValid =
    !deadlinePassed &&
    fromPlayersValid &&
    toPlayersValid &&
    fromPicksValid &&
    toPicksValid &&
    rosterOk &&
    capOk;

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

  await recordTradeNews(
    membership.careerId,
    membership.career.season,
    offer.toTeamId,
    offer.fromTeamId,
    fromPlayerIds,
    toPlayerIds,
    await getLocale()
  );

  revalidatePath("/");
  revalidatePath(`/teams/${offer.fromTeamId}`);
  revalidatePath(`/teams/${offer.toTeamId}`);
  revalidatePath("/trades");
  revalidatePath("/draft");
}

export async function cancelTradeOffer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const tradeOfferId = String(formData.get("tradeOfferId") ?? "");

  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId) });
  if (!membership) return;

  const offer = await prisma.tradeOffer.findUnique({ where: { id: tradeOfferId } });
  if (!offer || offer.careerId !== membership.careerId) return;
  if (offer.fromTeamId !== membership.teamId) return; // seul l'auteur peut annuler
  if (offer.status !== "pending") return;

  await prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "cancelled" } });
  revalidatePath("/trades");
}

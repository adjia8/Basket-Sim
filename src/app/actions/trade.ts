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
import { checkTradeSide, type CapVerdict } from "@/lib/careers/cap-rules";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
} from "@/lib/careers/roster-rules";
import {
  capSalary,
  NEGOTIATION_MAX_COUNTERS,
  rosterMoveAllowed,
} from "@/lib/careers/trade-rules";
import { ALT_CONTRACT_SLOTS_PER_TEAM } from "@/lib/careers/contract-type-rules";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { analyzeTrade, type TradeSelection, type TradeSide } from "@/lib/data-access/trade-analysis";
import { formatSalary } from "@/lib/utils";
import { applyTradeReactions } from "@/lib/data-access/trade-review";
import { currentGameDate, resolveHonoredPromises } from "@/lib/data-access/trade-requests";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

export interface TradeFormState {
  error?: string;
  success?: string;
  negotiationOver?: boolean; // l'équipe a rompu la négociation (offre retirée)
}

function selectionFrom(formData: FormData): TradeSelection {
  return {
    opponentTeamId: String(formData.get("opponentTeamId") ?? ""),
    myPlayerIds: formData.getAll("myPlayerIds").map(String),
    theirPlayerIds: formData.getAll("theirPlayerIds").map(String),
    myPickIds: formData.getAll("myPickIds").map(String),
    theirPickIds: formData.getAll("theirPickIds").map(String),
  };
}

// Messages d'erreur communs à l'aperçu et à la proposition.
function capError(t: Translator, locale: Locale, cap: Exclude<CapVerdict, { ok: true }>): string {
  const limit = formatSalary(cap.limit, locale);
  if (cap.reason === "salary_matching") return t("tradeAction.salaryMatching", { limit });
  if (cap.reason === "apron") return t("tradeAction.exceedsApron", { limit });
  return t("tradeAction.exceedsCap", { cap: limit });
}

export interface TradePreview {
  error?: string;
  complete?: boolean;
  me?: TradeSide;
  them?: TradeSide;
  salaryCap?: number;
  taxLine?: number;
  rosterError?: string;
  capError?: string;
  opponentHuman?: boolean;
  outlook?: string;
  interest?: string;
  refusal?: string; // raison principale si l'IA refuserait
  suggestion?: { kind: "pick" | "player"; id: string };
}

// Centre des transferts : aperçu en direct (aucune écriture) — chiffres,
// règles et intérêt de l'équipe adverse pendant le montage de l'échange.
export async function previewTrade(formData: FormData): Promise<TradePreview> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const membership = await prisma.membership.findFirst({ where: await activeMembershipWhere(userId), include: { career: true } });
  if (!membership) return { error: t("tradeAction.noCareer") };
  const a = await analyzeTrade(membership.careerId, membership.teamId, membership.career.leagueId, membership.career.season, selectionFrom(formData));
  if (!a.valid) return { error: t(`tradeAction.${a.error}`) };
  return {
    complete: a.complete,
    me: a.me,
    them: a.them,
    salaryCap: a.salaryCap,
    taxLine: a.taxLine,
    rosterError: a.rosterOk ? undefined : t("tradeAction.rosterSizeOutOfRange", { min: a.rosterMin, max: a.rosterMax }),
    capError: a.cap.ok ? undefined : capError(t, locale, a.cap),
    opponentHuman: a.opponentHuman,
    outlook: a.ai?.outlook,
    interest: a.ai?.interest,
    refusal: a.ai && !a.ai.decision.accept ? a.ai.decision.reason ?? "value" : undefined,
    suggestion: a.ai?.suggestion ?? undefined,
  };
}

export async function proposeTrade(
  _prevState: TradeFormState | undefined,
  formData: FormData
): Promise<TradeFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const sel = selectionFrom(formData);
  const { opponentTeamId, myPlayerIds, theirPlayerIds, myPickIds, theirPickIds } = sel;

  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true },
  });
  if (!membership) return { error: t("tradeAction.noCareer") };

  if (await isTradeDeadlinePassed(membership.careerId, membership.career.season)) {
    return { error: t("tradeAction.deadlinePassed") };
  }
  if (myPlayerIds.length + myPickIds.length === 0 || theirPlayerIds.length + theirPickIds.length === 0) {
    return { error: t("tradeAction.selectAtLeastOne") };
  }

  // Mêmes règles que l'aperçu (voir trade-analysis.ts).
  const analysis = await analyzeTrade(membership.careerId, membership.teamId, membership.career.leagueId, membership.career.season, sel);
  if (!analysis.valid) return { error: t(`tradeAction.${analysis.error}`) };
  if (!analysis.rosterOk) {
    return { error: t("tradeAction.rosterSizeOutOfRange", { min: analysis.rosterMin, max: analysis.rosterMax }) };
  }
  if (!analysis.cap.ok) return { error: capError(t, locale, analysis.cap) };

  const opponentTeam = await prisma.team.findUniqueOrThrow({ where: { id: opponentTeamId } });
  const opponentManager = await getMembershipForTeam(membership.careerId, opponentTeamId);
  // Contre-proposition à une offre reçue de cette équipe (négociation).
  const counterOfferId = String(formData.get("counterOfferId") ?? "");
  const counter = counterOfferId
    ? await prisma.tradeOffer.findFirst({
        where: { id: counterOfferId, careerId: membership.careerId, toTeamId: membership.teamId, fromTeamId: opponentTeamId, status: "pending" },
      })
    : null;
  if (!opponentManager) {
    // Adversaire IA : il juge l'échange selon SA situation (voir
    // evaluateTradeForAi) — reconstruction, milieu de tableau ou prétendant.
    const decision = analysis.ai!.decision;
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
      if (counter) {
        // Chaque contre-proposition refusée entame la patience de l'équipe ;
        // à bout, elle retire son offre.
        const attempts = counter.counterAttempts + 1;
        if (attempts >= NEGOTIATION_MAX_COUNTERS) {
          await prisma.tradeOffer.update({ where: { id: counter.id }, data: { status: "cancelled", counterAttempts: attempts } });
          revalidatePath("/trades");
          return { error: t("tradeAction.negotiationsBroken", { team }), negotiationOver: true };
        }
        await prisma.tradeOffer.update({ where: { id: counter.id }, data: { counterAttempts: attempts } });
        return { error: `${t(key, { team })} ${t("tradeAction.counterAttemptsLeft", { n: NEGOTIATION_MAX_COUNTERS - attempts })}` };
      }
      return { error: t(key, { team }) };
    }

    await prisma.$transaction([
      // L'offre d'origine est remplacée par l'accord négocié.
      ...(counter ? [prisma.tradeOffer.update({ where: { id: counter.id }, data: { status: "countered" } })] : []),
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
    // Promesse d'échange faite à un joueur cédé : tenue tout de suite.
    await resolveHonoredPromises(membership.careerId, membership.teamId, membership.career.season, await currentGameDate(membership.careerId), locale);
    // Réactions des fans et de la direction (opinion, confiance, message).
    const reactions = await applyTradeReactions({
      careerId: membership.careerId,
      season: membership.career.season,
      leagueId: membership.career.leagueId,
      teamId: membership.teamId,
      incomingPlayerIds: theirPlayerIds,
      outgoingPlayerIds: myPlayerIds,
      incomingPickIds: theirPickIds,
      outgoingPickIds: myPickIds,
      t,
    });

    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath(`/teams/${membership.teamId}`);
    revalidatePath(`/teams/${opponentTeamId}`);
    revalidatePath("/draft");
    revalidatePath("/trades");

    const suffix = reactions
      ? " " +
        t("tradeReaction.successSuffix", {
          fans: t(`tradeReaction.mood.${reactions.fans.mood}` as DictionaryKey),
          board: t(`tradeReaction.mood.${reactions.board.mood}` as DictionaryKey),
        })
      : "";
    return { success: t("tradeAction.accepted") + suffix };
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

  if (counter) await prisma.tradeOffer.update({ where: { id: counter.id }, data: { status: "countered" } });
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
  for (const id of [offer.toTeamId, offer.fromTeamId]) {
    await resolveHonoredPromises(membership.careerId, id, membership.career.season, await currentGameDate(membership.careerId), await getLocale());
  }
  // Réactions des fans et de la direction, pour chaque équipe humaine.
  const { t } = await getTranslator();
  const base = { careerId: membership.careerId, season: membership.career.season, leagueId: membership.career.leagueId, t };
  await applyTradeReactions({
    ...base,
    teamId: offer.toTeamId,
    incomingPlayerIds: fromPlayerIds,
    outgoingPlayerIds: toPlayerIds,
    incomingPickIds: fromPickIds,
    outgoingPickIds: toPickIds,
  });
  await applyTradeReactions({
    ...base,
    teamId: offer.fromTeamId,
    incomingPlayerIds: toPlayerIds,
    outgoingPlayerIds: fromPlayerIds,
    incomingPickIds: toPickIds,
    outgoingPickIds: fromPickIds,
  });
  revalidatePath("/inbox");

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

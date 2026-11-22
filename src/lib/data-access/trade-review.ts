import "server-only";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/data-access/standings";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { NBA_TAX_LINE } from "@/lib/careers/cap-rules";
import { teamOutlook, type TeamOutlook } from "@/lib/careers/trade-rules";
import { winPctForStandings } from "@/lib/careers/player-demands";
import {
  assistantTradeReview,
  tradeReactions,
  type ReviewAsset,
  type TradeReactions,
  type TradeReview,
} from "@/lib/careers/trade-review-rules";
import type { Translator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

// Détail des offres d'échange (âge, poste, stats, contrat) + avis de
// l'entraîneur adjoint, et réactions des fans / de la direction après un
// échange conclu. Voir trade-review-rules.ts pour les règles.

export interface PlayerAssetView {
  kind: "player";
  id: string;
  teamId: string;
  name: string;
  position: string;
  age: number;
  overall: number;
  salary: number;
  yearsRemaining: number;
  contractType: string;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  mpg: number;
}
export interface PickAssetView {
  kind: "pick";
  id: string;
  round: number;
  pickNumber: number | null;
  season: string;
  originalAbbr: string;
}
export type AssetView = PlayerAssetView | PickAssetView;

interface LoadedAssets {
  views: Map<string, AssetView>;
  review: Map<string, ReviewAsset>;
}

async function loadAssets(careerId: string, season: string, playerIds: string[], pickIds: string[]): Promise<LoadedAssets> {
  const [players, states, contracts, stats, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, lastName: true, position: true, age: true, overallRating: true } }),
    prisma.playerState.findMany({ where: { careerId, playerId: { in: playerIds } }, select: { playerId: true, age: true, overallRating: true, renown: true } }),
    prisma.contract.findMany({ where: { careerId, playerId: { in: playerIds } } }),
    prisma.playerSeasonStat.findMany({ where: { careerId, season, playerId: { in: playerIds } } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, include: { originalTeam: { select: { abbreviation: true } } } }),
  ]);
  const state = new Map(states.map((s) => [s.playerId, s]));
  const contract = new Map(contracts.map((c) => [c.playerId, c]));
  const stat = new Map(stats.map((s) => [s.playerId, s]));
  const views = new Map<string, AssetView>();
  const review = new Map<string, ReviewAsset>();
  for (const p of players) {
    const st = state.get(p.id);
    const c = contract.get(p.id);
    const s = stat.get(p.id);
    const gp = s?.gamesPlayed ?? 0;
    const per = (v: number) => (gp > 0 ? v / gp : 0);
    const name = `${p.firstName} ${p.lastName}`;
    const overall = st?.overallRating ?? p.overallRating;
    const age = st?.age ?? p.age;
    views.set(p.id, {
      kind: "player",
      id: p.id,
      teamId: c?.teamId ?? "",
      name,
      position: p.position,
      age,
      overall,
      salary: c?.salary ?? 0,
      yearsRemaining: c?.yearsRemaining ?? 0,
      contractType: c?.contractType ?? "standard",
      gamesPlayed: gp,
      ppg: per(s?.points ?? 0),
      rpg: per(s?.rebounds ?? 0),
      apg: per(s?.assists ?? 0),
      mpg: per(s?.minutes ?? 0),
    });
    review.set(p.id, {
      kind: "player",
      id: p.id,
      name,
      position: p.position,
      overall,
      age,
      salary: c?.salary ?? 0,
      standard: (c?.contractType ?? "standard") === "standard",
      yearsRemaining: c?.yearsRemaining ?? 0,
      renown: st?.renown ?? 50,
    });
  }
  for (const pk of picks) {
    views.set(pk.id, { kind: "pick", id: pk.id, round: pk.round, pickNumber: pk.pickNumber, season: pk.season, originalAbbr: pk.originalTeam.abbreviation });
    review.set(pk.id, { kind: "pick", id: pk.id, round: pk.round, pickNumber: pk.pickNumber });
  }
  return { views, review };
}

async function outlookOf(careerId: string, leagueId: string, season: string, teamId: string): Promise<TeamOutlook> {
  const [standings, expectations] = await Promise.all([getStandings(careerId, leagueId, season), getCareerExpectations(careerId, leagueId)]);
  const row = standings.find((r) => r.teamId === teamId);
  return teamOutlook({
    winPct: winPctForStandings(row?.wins ?? 0, row?.losses ?? 0),
    gamesPlayed: (row?.wins ?? 0) + (row?.losses ?? 0),
    expectation: expectations.get(teamId) ?? null,
  });
}

export interface OfferDetail {
  offerId: string;
  incoming: AssetView[]; // ce que je reçois
  outgoing: AssetView[]; // ce que je cède
  salaryIn: number;
  salaryOut: number;
  review: TradeReview | null;
  adviser: string | null;
  adviserSkill: number;
}

type OfferLike = { id: string; fromTeamId: string; toTeamId: string; items: { side: string; playerId: string | null; draftPickId: string | null }[] };

// Détail de chaque offre du point de vue de `myTeamId` ; l'avis de
// l'adjoint seulement pour les offres reçues (`withReview`).
export async function getOfferDetails(
  careerId: string,
  myTeamId: string,
  leagueId: string,
  season: string,
  offers: OfferLike[],
  withReview: (offer: OfferLike) => boolean
): Promise<Map<string, OfferDetail>> {
  const result = new Map<string, OfferDetail>();
  if (offers.length === 0) return result;
  const playerIds = [...new Set(offers.flatMap((o) => o.items.map((i) => i.playerId).filter((x): x is string => !!x)))];
  const pickIds = [...new Set(offers.flatMap((o) => o.items.map((i) => i.draftPickId).filter((x): x is string => !!x)))];
  const needReview = offers.some(withReview);
  const [assets, adviserRow, outlook, payroll, teamCount, myRoster] = await Promise.all([
    loadAssets(careerId, season, playerIds, pickIds),
    needReview
      ? prisma.staffMember.findFirst({
          where: { careerId, teamId: myTeamId, role: "assistant_coach" },
          orderBy: { rating: "desc" },
          select: { firstName: true, lastName: true, rating: true },
        })
      : Promise.resolve(null),
    needReview ? outlookOf(careerId, leagueId, season, myTeamId) : Promise.resolve("middle" as TeamOutlook),
    needReview ? getPayrollForTeam(careerId, myTeamId) : Promise.resolve(0),
    prisma.team.count({ where: { leagueId } }),
    needReview
      ? prisma.contract.findMany({ where: { careerId, teamId: myTeamId }, select: { playerId: true, player: { select: { position: true, overallRating: true } } } })
      : Promise.resolve([]),
  ]);
  const myStates = needReview
    ? await prisma.playerState.findMany({ where: { careerId, playerId: { in: myRoster.map((c) => c.playerId) } }, select: { playerId: true, overallRating: true } })
    : [];
  const myOverall = new Map(myStates.map((s) => [s.playerId, s.overallRating]));
  const roster = myRoster.map((c) => ({ id: c.playerId, position: c.player.position, overall: myOverall.get(c.playerId) ?? c.player.overallRating }));
  const skill = adviserRow?.rating ?? 40;

  for (const o of offers) {
    // Côté « from » = l'équipe qui propose ; je reçois ce que l'autre côté donne.
    const mySide = o.fromTeamId === myTeamId ? "from" : "to";
    const ids = (side: string) => o.items.filter((i) => i.side === side).map((i) => (i.playerId ?? i.draftPickId)!) as string[];
    const outgoingIds = ids(mySide);
    const incomingIds = ids(mySide === "from" ? "to" : "from");
    const incoming = incomingIds.map((id) => assets.views.get(id)).filter((x): x is AssetView => !!x);
    const outgoing = outgoingIds.map((id) => assets.views.get(id)).filter((x): x is AssetView => !!x);
    const sal = (list: AssetView[]) => list.reduce((s, a) => s + (a.kind === "player" && a.contractType === "standard" ? a.salary : 0), 0);
    let review: TradeReview | null = null;
    if (withReview(o)) {
      review = assistantTradeReview({
        incoming: incomingIds.map((id) => assets.review.get(id)).filter((x): x is ReviewAsset => !!x),
        outgoing: outgoingIds.map((id) => assets.review.get(id)).filter((x): x is ReviewAsset => !!x),
        outlook,
        picksPerRound: teamCount,
        payrollBefore: payroll,
        taxLine: leagueId === "nba" ? NBA_TAX_LINE : Infinity,
        roster,
        skill,
        seed: `${careerId}:${o.id}`,
      });
    }
    result.set(o.id, {
      offerId: o.id,
      incoming,
      outgoing,
      salaryIn: sal(incoming),
      salaryOut: sal(outgoing),
      review,
      adviser: adviserRow ? `${adviserRow.firstName} ${adviserRow.lastName}` : null,
      adviserSkill: skill,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Réactions après un échange conclu (à appeler APRÈS la mise à jour des
// contrats) : opinion des fans (TeamState.publicOpinion), confiance de la
// direction (GmProfile.frontOfficeApproval) et message en boîte de
// réception. Sans effet pour une équipe gérée par l'IA.

export async function applyTradeReactions(params: {
  careerId: string;
  season: string;
  leagueId: string;
  teamId: string;
  incomingPlayerIds: string[];
  outgoingPlayerIds: string[];
  incomingPickIds: string[];
  outgoingPickIds: string[];
  t: Translator;
}): Promise<TradeReactions | null> {
  const { careerId, season, leagueId, teamId, t } = params;
  const membership = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
    select: { gmProfile: { select: { id: true, frontOfficeApproval: true } } },
  });
  if (!membership) return null;
  const gm = membership.gmProfile;
  const [assets, outlook, payrollAfter, teamCount, state] = await Promise.all([
    loadAssets(careerId, season, [...params.incomingPlayerIds, ...params.outgoingPlayerIds], [...params.incomingPickIds, ...params.outgoingPickIds]),
    outlookOf(careerId, leagueId, season, teamId),
    getPayrollForTeam(careerId, teamId),
    prisma.team.count({ where: { leagueId } }),
    prisma.teamState.findFirst({ where: { careerId, teamId }, select: { id: true, publicOpinion: true } }),
  ]);
  const pick = (ids: string[]) => ids.map((id) => assets.review.get(id)).filter((x): x is ReviewAsset => !!x);
  const incoming = pick([...params.incomingPlayerIds, ...params.incomingPickIds]);
  const outgoing = pick([...params.outgoingPlayerIds, ...params.outgoingPickIds]);
  const std = (list: ReviewAsset[]) => list.reduce((s, a) => s + (a.kind === "player" && a.standard ? a.salary : 0), 0);
  const payrollBefore = payrollAfter - std(incoming) + std(outgoing);
  const reactions = tradeReactions({
    incoming,
    outgoing,
    outlook,
    picksPerRound: teamCount,
    payrollBefore,
    taxLine: leagueId === "nba" ? NBA_TAX_LINE : Infinity,
  });

  const clamp = (v: number) => Math.max(0, Math.min(99, v));
  await Promise.all([
    state && reactions.fans.delta !== 0
      ? prisma.teamState.update({ where: { id: state.id }, data: { publicOpinion: clamp(state.publicOpinion + reactions.fans.delta) } })
      : null,
    gm && reactions.board.delta !== 0
      ? prisma.gmProfile.update({ where: { id: gm.id }, data: { frontOfficeApproval: clamp(gm.frontOfficeApproval + reactions.board.delta) } })
      : null,
  ]);

  const names = (list: ReviewAsset[]) => list.filter((a) => a.kind === "player").map((a) => (a as { name: string }).name);
  const arrivals = names(incoming).join(", ") || t("tradeReaction.picksOnly");
  const fans = [
    t(`tradeReaction.fans.${reactions.fans.mood}` as DictionaryKey, { arrivals }),
    reactions.fans.favourite ? t("tradeReaction.fans.favourite", { name: reactions.fans.favourite }) : "",
    reactions.fans.star ? t("tradeReaction.fans.star", { name: reactions.fans.star }) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const board = `${t(`tradeReaction.board.${reactions.board.mood}` as DictionaryKey)} ${t(`tradeReaction.boardReason.${reactions.board.reason}` as DictionaryKey)}`;
  const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  const body = [
    `${t("tradeReaction.fansTitle")} — ${fans}`,
    `${t("tradeReaction.boardTitle")} — ${board}`,
    t("tradeReaction.effects", { fans: signed(reactions.fans.delta), board: signed(reactions.board.delta) }),
  ].join("\n\n");
  const negative = reactions.fans.delta <= -4 || reactions.board.delta <= -3;
  await createInboxMessage(careerId, teamId, season, "trade_reaction", t("tradeReaction.title", { arrivals }), body, "/trades", {
    priority: negative ? "important" : "info",
  });
  return reactions;
}

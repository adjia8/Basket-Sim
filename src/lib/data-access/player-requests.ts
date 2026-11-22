import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { clampMorale } from "@/lib/careers/morale-rules";
import { personalityFor, scaleMoraleDelta } from "@/lib/careers/personality-rules";
import { EXPECTED_MINUTES, MINUTES_TOLERANCE, playerStatus, rankInRoster } from "@/lib/careers/player-status-rules";
import { EXTENSION_MAX_YEARS_REMAINING } from "@/lib/careers/contract-type-rules";
import {
  REQUEST_IGNORED_AFTER_DAYS,
  REQUEST_IGNORED_MORALE,
  REQUEST_PLAYER_COOLDOWN_DAYS,
  REQUEST_TEAM_COOLDOWN_DAYS,
  ignoredLeadsToTradeRequest,
  requestTrigger,
  type PlayerRequest,
} from "@/lib/careers/player-request-rules";
import type { Locale } from "@/lib/i18n/locale";
import { translatorFor } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { baselineTiers, effectiveTier, parsePlan, projectDef, type ProjectKey } from "@/lib/careers/facility-projects-rules";
import {
  desiredFacility,
  facilityRequestOutcome,
  FACILITY_BROKEN_MORALE,
  FACILITY_DELIVERED_MORALE,
  FACILITY_REQUEST_CHANCE,
  FACILITY_STARTED_MORALE,
} from "@/lib/careers/facility-request-rules";

const DAY_MS = 86_400_000;
const days = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

const REQUEST_TEXT: Record<PlayerRequest, { fr: [string, string]; en: [string, string] }> = {
  minutes: {
    fr: ["{name} veut parler de son temps de jeu", "{name} trouve qu'il ne joue pas assez pour son rôle et demande à te voir."],
    en: ["{name} wants to talk about his minutes", "{name} feels he isn't playing enough for his role and asks to see you."],
  },
  contract: {
    fr: ["{name} s'interroge sur son avenir", "{name} entame la dernière année de son contrat et aimerait savoir où il en est."],
    en: ["{name} wonders about his future", "{name} is entering the final year of his contract and would like to know where he stands."],
  },
  support: {
    fr: ["{name} demande à te parler", "{name} traverse une période difficile et a besoin de se sentir soutenu."],
    en: ["{name} asks to talk to you", "{name} is going through a rough patch and needs to feel supported."],
  },
  facilities: {
    fr: ["{name} réclame un {facility} plus moderne", "{name} estime que le club doit investir dans son {facility} pour rester au niveau. Lance le chantier depuis la page Franchise, ou parle-lui."],
    en: ["{name} wants a more modern {facility}", "{name} believes the club must invest in its {facility} to keep up. Start the build from the Franchise page, or talk to him."],
  },
};

// Après chaque match d'une équipe humaine : sanctionne les demandes restées
// sans réponse une semaine, puis laisse éventuellement un joueur en formuler
// une nouvelle (au plus une tous les REQUEST_TEAM_COOLDOWN_DAYS jours).
export async function maybePlayerRequests(
  careerId: string,
  teamId: string,
  season: string,
  gameDate: Date,
  locale: Locale
): Promise<void> {
  const fr = locale === "fr";
  const contracts = await prisma.contract.findMany({
    where: { careerId, teamId, contractType: "standard" },
    select: { playerId: true, yearsRemaining: true, isRookieScale: true },
  });
  const ids = contracts.map((c) => c.playerId);
  const [states, stats, teamState, injuries] = await Promise.all([
    prisma.playerState.findMany({
      where: { careerId, playerId: { in: ids } },
      include: { player: { select: { firstName: true, lastName: true } } },
    }),
    prisma.playerSeasonStat.findMany({ where: { careerId, season, playerId: { in: ids } } }),
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
    prisma.injuryRecord.groupBy({ by: ["playerId"], where: { careerId, season, playerId: { in: ids } }, _count: { _all: true } }),
  ]);
  const injuriesById = new Map(injuries.map((r) => [r.playerId, r._count._all]));
  const name = (s: (typeof states)[number]) => `${s.player.firstName} ${s.player.lastName}`;

  // 1. Demandes ignorées.
  for (const s of states) {
    if (!s.pendingRequest || !s.requestAt || days(s.requestAt, gameDate) < REQUEST_IGNORED_AFTER_DAYS) continue;
    const p = personalityFor(s.playerId, s.age);
    const toTrade = ignoredLeadsToTradeRequest(p) && !s.wantsTrade;
    const updated = await prisma.playerState.updateMany({
      where: { id: s.id, pendingRequest: s.pendingRequest },
      data: {
        pendingRequest: null,
        requestAt: null,
        ...(s.pendingRequest === "facilities" ? { facilityRequestKey: null, facilityRequestTier: null } : {}),
        morale: clampMorale(s.morale + scaleMoraleDelta(REQUEST_IGNORED_MORALE, p)),
        ...(toTrade ? { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(["morale"]), tradeRequestSinceSeason: season } : {}),
      },
    });
    if (updated.count === 0) continue;
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_reaction",
      fr ? `${name(s)} se sent ignoré` : `${name(s)} feels ignored`,
      fr
        ? `Tu n'as pas répondu à sa demande depuis une semaine. Son moral en prend un coup${toTrade ? ", et il demande désormais à être échangé" : ""}.`
        : `You haven't answered his request for a week. His morale takes a hit${toTrade ? ", and he now wants to be traded" : ""}.`,
      `/teams/${teamId}/players/${s.playerId}`,
      { gameDate, playerId: s.playerId, priority: toTrade ? "urgent" : "important" }
    );
  }

  // 1 bis. Demandes d'installations : livrée, chantier lancé, promesse rompue.
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { marketAppeal: true } });
  const plan = parsePlan(teamState?.facilityProjectsJson);
  const baseline = baselineTiers(teamId, team?.marketAppeal ?? 50);
  const tf = translatorFor(locale);
  for (const s of states) {
    if (!s.facilityRequestKey || !s.facilityRequestTier) continue;
    const key = s.facilityRequestKey as ProjectKey;
    const building = plan.projects.find((p) => p.key === key && p.status === "building");
    const outcome = facilityRequestOutcome({
      currentTier: effectiveTier(plan, key, baseline),
      wantedTier: s.facilityRequestTier,
      building: !!building,
      promiseBy: s.facilityPromiseBy,
      today: gameDate,
    });
    if (outcome === "waiting") continue;
    // Chantier lancé : il le salue une fois, puis attend la livraison.
    if (outcome === "started" && s.facilityPromiseBy && building && s.facilityPromiseBy.getTime() > new Date(building.completesOn).getTime()) continue;
    const p = personalityFor(s.playerId, s.age);
    const facility = tf(`facility.project.${key}.name` as DictionaryKey);
    const delta =
      outcome === "delivered" ? FACILITY_DELIVERED_MORALE : outcome === "started" ? FACILITY_STARTED_MORALE : FACILITY_BROKEN_MORALE;
    const toTrade = outcome === "broken" && ignoredLeadsToTradeRequest(p) && !s.wantsTrade;
    await prisma.playerState.update({
      where: { id: s.id },
      data: {
        morale: clampMorale(s.morale + scaleMoraleDelta(delta, p)),
        ...(outcome === "started"
          ? // Attend la livraison (avec une marge) ; la demande est entendue.
            { facilityPromiseBy: new Date(new Date(building!.completesOn).getTime() + 14 * DAY_MS), ...(s.pendingRequest === "facilities" ? { pendingRequest: null, requestAt: null } : {}) }
          : { facilityRequestKey: null, facilityRequestTier: null, facilityPromiseBy: null, ...(s.pendingRequest === "facilities" ? { pendingRequest: null, requestAt: null } : {}) }),
        ...(toTrade ? { wantsTrade: true, tradeRequestReasonsJson: JSON.stringify(["facilities"]), tradeRequestSinceSeason: season } : {}),
      },
    });
    const text = {
      delivered: fr
        ? [`${name(s)} savoure le nouveau ${facility}`, `Sa demande est satisfaite : ${name(s)} apprécie l'investissement du club. Son moral grimpe.`]
        : [`${name(s)} loves the new ${facility}`, `His request has been met: ${name(s)} appreciates the club's investment. His morale rises.`],
      started: fr
        ? [`${name(s)} salue le lancement du chantier`, `Les travaux du ${facility} ont commencé : ${name(s)} se sent écouté et attend la livraison.`]
        : [`${name(s)} welcomes the start of construction`, `Work on the ${facility} has begun: ${name(s)} feels heard and awaits delivery.`],
      broken: fr
        ? [`${name(s)} se sent trahi`, `Le ${facility} promis n'a jamais vu le jour. ${name(s)} le prend très mal${toTrade ? " et demande désormais à être échangé" : ""}.`]
        : [`${name(s)} feels let down`, `The promised ${facility} never happened. ${name(s)} takes it very badly${toTrade ? " and now wants to be traded" : ""}.`],
    }[outcome];
    await createInboxMessage(careerId, teamId, season, "player_reaction", text[0], text[1], `/teams/${teamId}/players/${s.playerId}`, {
      gameDate,
      playerId: s.playerId,
      priority: outcome === "broken" ? (toTrade ? "urgent" : "important") : "info",
    });
  }

  // 2. Nouvelle demande éventuelle.
  if (teamState?.lastPlayerRequestAt && days(teamState.lastPlayerRequestAt, gameDate) < REQUEST_TEAM_COOLDOWN_DAYS) return;
  const overalls = new Map(states.map((s) => [s.playerId, s.overallRating]));
  const mins = new Map<string, { m: number; g: number }>();
  for (const r of stats) {
    const x = mins.get(r.playerId) ?? { m: 0, g: 0 };
    x.m += r.minutes;
    x.g += r.gamesPlayed;
    mins.set(r.playerId, x);
  }
  const candidates = [...states].sort(() => Math.random() - 0.5);
  for (const s of candidates) {
    if (s.retired || s.injured || s.pendingRequest) continue;
    if (s.lastRequestAt && days(s.lastRequestAt, gameDate) < REQUEST_PLAYER_COOLDOWN_DAYS) continue;
    const contract = contracts.find((c) => c.playerId === s.playerId)!;
    const status = playerStatus({
      overall: s.overallRating,
      renown: s.renown,
      age: s.age,
      potential: s.potential || s.overallRating,
      teamRank: rankInRoster(s.overallRating, [...overalls].filter(([id]) => id !== s.playerId).map(([, o]) => o)),
    });
    const m = mins.get(s.playerId);
    const request = requestTrigger({
      personality: personalityFor(s.playerId, s.age),
      morale: s.morale,
      underExpectedMinutes: !!m && m.g >= 8 && m.m / m.g < EXPECTED_MINUTES[status] - MINUTES_TOLERANCE,
      contractYearsLeft: contract.yearsRemaining,
      extensionEligible: contract.yearsRemaining <= EXTENSION_MAX_YEARS_REMAINING,
      rookieScale: contract.isRookieScale,
    });
    // Sinon, une star peut réclamer une installation (voir facility-request-rules.ts).
    const wanted =
      !request && !s.facilityRequestKey && Math.random() < FACILITY_REQUEST_CHANCE
        ? desiredFacility(
            {
              age: s.age,
              renown: s.renown,
              overall: s.overallRating,
              potential: s.potential || s.overallRating,
              wear: s.wear,
              injuriesThisSeason: injuriesById.get(s.playerId) ?? 0,
            },
            (key) => effectiveTier(plan, key, baseline),
            (key) => projectDef(key)?.tiers.length ?? 0
          )
        : null;
    // Pas pendant qu'on construit déjà ce qu'il demande.
    const facilityAsk = wanted && !plan.projects.some((p) => p.key === wanted.key && p.status === "building") ? wanted : null;
    const finalRequest: PlayerRequest | null = request ?? (facilityAsk ? "facilities" : null);
    if (!finalRequest) continue;
    const claimed = await prisma.playerState.updateMany({
      where: { id: s.id, pendingRequest: null },
      data: {
        pendingRequest: finalRequest,
        requestAt: gameDate,
        lastRequestAt: gameDate,
        ...(facilityAsk && !request ? { facilityRequestKey: facilityAsk.key, facilityRequestTier: facilityAsk.tier, facilityPromiseBy: null } : {}),
      },
    });
    if (claimed.count === 0) continue;
    if (teamState) await prisma.teamState.update({ where: { id: teamState.id }, data: { lastPlayerRequestAt: gameDate } });
    const [title, body] = REQUEST_TEXT[finalRequest][fr ? "fr" : "en"];
    const facilityName = facilityAsk ? tf(`facility.project.${facilityAsk.key}.name` as DictionaryKey) : "";
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "player_request",
      title.replace("{name}", name(s)).replace("{facility}", facilityName),
      body.replace("{name}", name(s)).replace("{facility}", facilityName) +
        (fr ? " Réponds-lui depuis sa fiche dans la semaine." : " Answer him from his player page within a week."),
      `/teams/${teamId}/players/${s.playerId}`,
      { gameDate, playerId: s.playerId }
    );
    return; // une seule nouvelle demande à la fois
  }
}

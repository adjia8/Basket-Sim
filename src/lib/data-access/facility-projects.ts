import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { addUpgradeToLedger } from "@/lib/data-access/finance";
import { clampFacilityLevel, upgradeCost } from "@/lib/careers/finance-rules";
import {
  addDays,
  baselineTiers,
  effectiveTier,
  PROJECTS,
  projectStars,
  dueProjects,
  financingPlan,
  ownersAcceptChance,
  parsePlan,
  projectDef,
  projectOptions,
  type Financing,
  type ProjectKey,
} from "@/lib/careers/facility-projects-rules";
import { translatorFor } from "@/lib/i18n/translate";
import { tierEffectLines } from "@/lib/careers/facility-effects-text";
import type { Locale } from "@/lib/i18n/locale";
import type { DictionaryKey } from "@/lib/i18n/dictionary";

// Projets d'infrastructure : lancement (avec financement), livraison des
// chantiers terminés. Voir facility-projects-rules.ts.

// Livre les chantiers arrivés à échéance : niveau global, opinion des
// fans, message en boîte de réception (équipe humaine).
export async function settleFacilityProjects(
  careerId: string,
  teamId: string,
  season: string,
  today: Date,
  locale: Locale
): Promise<void> {
  const state = await prisma.teamState.findFirst({
    where: { careerId, teamId },
    select: { id: true, facilityProjectsJson: true, facilitiesLevel: true, arenaLevel: true, publicOpinion: true },
  });
  if (!state?.facilityProjectsJson || !state.facilityProjectsJson.includes('"building"')) return;
  const plan = parsePlan(state.facilityProjectsJson);
  const due = dueProjects(plan, today.toISOString());
  if (due.length === 0) return;
  let facilities = state.facilitiesLevel;
  let arena = state.arenaLevel;
  let opinion = state.publicOpinion;
  for (const p of due) {
    const def = projectDef(p.key);
    if (!def) continue;
    const tier = def.tiers[def.repeatable ? 0 : p.tier - 1];
    p.status = "done";
    if (def.domain === "training") facilities = clampFacilityLevel(facilities + tier.level);
    else arena = clampFacilityLevel(arena + tier.level);
    opinion = Math.max(0, Math.min(99, opinion + (tier.opinion ?? 0)));
  }
  await prisma.teamState.update({
    where: { id: state.id },
    data: { facilityProjectsJson: JSON.stringify(plan), facilitiesLevel: facilities, arenaLevel: arena, publicOpinion: opinion },
  });
  const human = await prisma.membership.findUnique({ where: { careerId_teamId: { careerId, teamId } }, select: { id: true } });
  if (!human) return;
  const t = translatorFor(locale);
  for (const p of due) {
    const name = t(`facility.project.${p.key}.name` as DictionaryKey);
    await createInboxMessage(
      careerId,
      teamId,
      season,
      "facility",
      t("facility.inbox.doneTitle", { name }),
      t("facility.inbox.doneBody", {
        name,
        tier: p.tier,
        effect: tierEffectLines(projectDef(p.key)!.tiers[projectDef(p.key)!.repeatable ? 0 : p.tier - 1], t, locale).join(" · "),
      }),
      "/franchise",
      { gameDate: today }
    );
  }
}

export type StartProjectResult =
  | { ok: true; ownersPaid: number; completesOn: string }
  | { ok: false; error: "unknown" | "maxed" | "exclusive" | "concurrent" | "building" | "funds" | "ownersRefused" | "ownersAlreadyAsked" };

export async function startFacilityProject(p: {
  careerId: string;
  teamId: string;
  leagueId: string;
  season: string;
  key: ProjectKey;
  financing: Financing;
  today: Date;
  approval: number; // confiance de la direction (0-99)
}): Promise<StartProjectResult> {
  const [state, team] = await Promise.all([
    prisma.teamState.findFirst({ where: { careerId: p.careerId, teamId: p.teamId } }),
    prisma.team.findUnique({ where: { id: p.teamId }, select: { marketAppeal: true } }),
  ]);
  if (!state) return { ok: false, error: "unknown" };
  const plan = parsePlan(state.facilityProjectsJson);
  const option = projectOptions(plan, p.leagueId, {
    training: upgradeCost(state.facilitiesLevel, p.leagueId, "training"),
    arena: upgradeCost(state.arenaLevel, p.leagueId, "arena"),
  }, baselineTiers(p.teamId, team?.marketAppeal ?? 50)).find((o) => o.def.key === p.key);
  if (!option) return { ok: false, error: "unknown" };
  if (option.building) return { ok: false, error: "building" };
  if (option.blockedBy) return { ok: false, error: option.blockedBy };
  const next = option.next!;
  const money = financingPlan(next.cost, p.financing);
  if (state.finances < money.now) return { ok: false, error: "funds" };

  if (p.financing === "owners") {
    if (plan.ownersRequestSeason === p.season) return { ok: false, error: "ownersAlreadyAsked" };
    plan.ownersRequestSeason = p.season;
    const accepted = Math.random() < ownersAcceptChance(p.approval, state.finances / Math.max(1, next.cost));
    if (!accepted) {
      await prisma.teamState.update({ where: { id: state.id }, data: { facilityProjectsJson: JSON.stringify(plan) } });
      return { ok: false, error: "ownersRefused" };
    }
  }

  const startedOn = p.today.toISOString();
  const completesOn = addDays(startedOn, next.days);
  plan.projects.push({ key: p.key, tier: next.tier, status: "building", startedOn, completesOn, cost: next.cost, financing: p.financing });
  if (money.seasons > 0) plan.loans.push({ key: p.key, tier: next.tier, perSeason: money.perSeason, seasonsLeft: money.seasons });
  await prisma.teamState.update({
    where: { id: state.id },
    data: {
      finances: state.finances - money.now,
      financeLedgerJson: addUpgradeToLedger(state.financeLedgerJson, p.season, money.now),
      facilityProjectsJson: JSON.stringify(plan),
    },
  });
  return { ok: true, ownersPaid: money.ownersPay, completesOn };
}

export interface FeatureComparison {
  stars: number; // mon équipe
  average: number; // moyenne de la ligue
  rank: number; // 1 = meilleure
  tied: boolean; // d'autres équipes ont la même note
  of: number;
  best: { teamName: string; stars: number } | null; // meilleure autre équipe
}

// Comparaison des installations avec toute la ligue : note sur 5 par
// installation (existant + construit), rang, moyenne, meilleure équipe.
// Clé « domain:training » / « domain:arena » : moyenne des installations.
export async function getFacilityComparison(careerId: string, leagueId: string, myTeamId: string): Promise<Map<string, FeatureComparison>> {
  const [teams, states] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true, city: true, name: true, marketAppeal: true } }),
    prisma.teamState.findMany({ where: { careerId }, select: { teamId: true, facilitiesLevel: true, arenaLevel: true, facilityProjectsJson: true } }),
  ]);
  const stateById = new Map(states.map((s) => [s.teamId, s]));
  const scores = new Map<string, Map<string, number>>(); // feature → team → stars
  const put = (feature: string, teamId: string, v: number) => {
    if (!scores.has(feature)) scores.set(feature, new Map());
    scores.get(feature)!.set(teamId, v);
  };
  for (const team of teams) {
    const st = stateById.get(team.id);
    const plan = parsePlan(st?.facilityProjectsJson);
    const baseline = baselineTiers(team.id, team.marketAppeal);
    const domainStars: Record<string, number[]> = { training: [], arena: [] };
    for (const def of PROJECTS) {
      const level = def.domain === "training" ? st?.facilitiesLevel ?? 50 : st?.arenaLevel ?? 50;
      // Loges / tribune : une seule des deux existe ; l'autre ne pèse pas dans la moyenne.
      const stars = projectStars(def, def.repeatable ? 0 : effectiveTier(plan, def.key, baseline), level);
      put(def.key, team.id, stars);
      if (!(def.exclusiveWith && effectiveTier(plan, def.key, baseline) === 0 && effectiveTier(plan, def.exclusiveWith, baseline) > 0)) {
        domainStars[def.domain].push(stars);
      }
    }
    for (const d of ["training", "arena"]) {
      const list = domainStars[d];
      put(`domain:${d}`, team.id, Math.round((list.reduce((a, b) => a + b, 0) / Math.max(1, list.length)) * 2) / 2);
    }
  }
  const name = new Map(teams.map((t) => [t.id, `${t.city} ${t.name}`]));
  const out = new Map<string, FeatureComparison>();
  for (const [feature, byTeam] of scores) {
    const mine = byTeam.get(myTeamId) ?? 0;
    const values = [...byTeam.values()];
    const others = [...byTeam].filter(([id]) => id !== myTeamId).sort((a, b) => b[1] - a[1]);
    out.set(feature, {
      stars: mine,
      average: Math.round((values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)) * 10) / 10,
      rank: values.filter((v) => v > mine).length + 1,
      tied: values.filter((v) => v === mine).length > 1,
      of: values.length,
      best: others[0] ? { teamName: name.get(others[0][0]) ?? others[0][0], stars: others[0][1] } : null,
    });
  }
  return out;
}

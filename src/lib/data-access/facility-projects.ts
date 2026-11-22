import "server-only";
import { prisma } from "@/lib/prisma";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { addUpgradeToLedger } from "@/lib/data-access/finance";
import { clampFacilityLevel, upgradeCost } from "@/lib/careers/finance-rules";
import {
  addDays,
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
  const state = await prisma.teamState.findFirst({ where: { careerId: p.careerId, teamId: p.teamId } });
  if (!state) return { ok: false, error: "unknown" };
  const plan = parsePlan(state.facilityProjectsJson);
  const option = projectOptions(plan, p.leagueId, {
    training: upgradeCost(state.facilitiesLevel, p.leagueId, "training"),
    arena: upgradeCost(state.arenaLevel, p.leagueId, "arena"),
  }).find((o) => o.def.key === p.key);
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

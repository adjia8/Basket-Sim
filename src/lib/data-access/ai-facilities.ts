import "server-only";
import { prisma } from "@/lib/prisma";
import { startFacilityProject } from "@/lib/data-access/facility-projects";
import { healthyFinancesThreshold, upgradeCost } from "@/lib/careers/finance-rules";
import {
  aiProjectChoice,
  baselineTiers,
  effectiveTier,
  parsePlan,
  projectDef,
  projectOptions,
  type FacilityDomain,
  type ProjectKey,
} from "@/lib/careers/facility-projects-rules";
import { desiredFacility } from "@/lib/careers/facility-request-rules";
import { translatorFor } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import { formatLongDate, formatSalary } from "@/lib/utils";

// Équipes gérées par l'IA : elles investissent elles aussi dans leurs
// installations (voir aiProjectChoice), selon leurs finances, leurs points
// faibles et ce que réclament leurs stars. Annonce dans l'actualité de la
// ligue pour les projets marquants.

const DAY = 86_400_000;
export const AI_PROJECT_COOLDOWN_DAYS = 45;
const AI_PROJECT_CHANCE = 0.25; // par passage, une fois le délai écoulé
const NEWSWORTHY_COST = 15_000_000;

// Tente un chantier pour une équipe IA. `preferDomain` : besoin urgent
// (joueur mécontent des installations). Renvoie la clé lancée, ou null.
export async function aiStartProject(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  today: Date,
  locale: Locale,
  opts: { preferDomain?: FacilityDomain; forPlayer?: string } = {}
): Promise<ProjectKey | null> {
  const [state, team, contracts] = await Promise.all([
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { city: true, name: true, marketAppeal: true } }),
    prisma.contract.findMany({ where: { careerId, teamId }, select: { playerId: true } }),
  ]);
  if (!state || !team) return null;
  const plan = parsePlan(state.facilityProjectsJson);
  if (plan.projects.some((p) => p.status === "building")) return null; // un chantier à la fois
  const baseline = baselineTiers(teamId, team.marketAppeal);
  const options = projectOptions(
    plan,
    leagueId,
    { training: upgradeCost(state.facilitiesLevel, leagueId, "training"), arena: upgradeCost(state.arenaLevel, leagueId, "arena") },
    baseline
  );
  // Ce que réclament ses joueurs renommés.
  const [states, injuries] = await Promise.all([
    prisma.playerState.findMany({
      where: { careerId, playerId: { in: contracts.map((c) => c.playerId) }, renown: { gte: 65 } },
      select: { playerId: true, age: true, renown: true, overallRating: true, potential: true, wear: true },
    }),
    prisma.injuryRecord.groupBy({ by: ["playerId"], where: { careerId, season, teamId }, _count: { _all: true } }),
  ]);
  const injuriesById = new Map(injuries.map((r) => [r.playerId, r._count._all]));
  const demanded = states
    .map((s) =>
      desiredFacility(
        { age: s.age, renown: s.renown, overall: s.overallRating, potential: s.potential || s.overallRating, wear: s.wear, injuriesThisSeason: injuriesById.get(s.playerId) ?? 0 },
        (k) => effectiveTier(plan, k, baseline),
        (k) => projectDef(k)?.tiers.length ?? 0
      )?.key
    )
    .filter((k): k is ProjectKey => !!k);
  const choice = aiProjectChoice(options, {
    finances: state.finances,
    reserve: healthyFinancesThreshold(leagueId),
    levels: { training: state.facilitiesLevel, arena: state.arenaLevel },
    demanded,
    preferDomain: opts.preferDomain,
  });
  if (!choice) return null;
  const res = await startFacilityProject({ careerId, teamId, leagueId, season, key: choice.key, financing: choice.financing, today, approval: 50 });
  if (!res.ok) return null;

  if (choice.cost >= NEWSWORTHY_COST || opts.forPlayer || demanded.includes(choice.key)) {
    const t = translatorFor(locale);
    const teamName = `${team.city} ${team.name}`;
    const project = t(`facility.project.${choice.key}.name` as DictionaryKey);
    await prisma.leagueNews.create({
      data: {
        careerId,
        season,
        type: "facility",
        teamId,
        title: t("aiLife.news.facilityTitle", { team: teamName, project }),
        body:
          t("aiLife.news.facilityBody", {
            team: teamName,
            project,
            cost: formatSalary(choice.cost, locale),
            date: formatLongDate(res.completesOn, locale),
          }) + (opts.forPlayer ? ` ${t("aiLife.news.facilityForPlayer", { player: opts.forPlayer })}` : ""),
      },
    });
  }
  return choice.key;
}

// Passage régulier (après les lots de matchs, et à l'intersaison) : chaque
// équipe IA sans chantier récent peut en lancer un.
export async function maybeAiFacilityProjects(careerId: string, leagueId: string, season: string, today: Date, locale: Locale, chance = AI_PROJECT_CHANCE): Promise<number> {
  const [teams, humans, states] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true } }),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
    prisma.teamState.findMany({ where: { careerId }, select: { teamId: true, facilityProjectsJson: true } }),
  ]);
  const human = new Set(humans.map((h) => h.teamId));
  const planOf = new Map(states.map((s) => [s.teamId, parsePlan(s.facilityProjectsJson)]));
  let started = 0;
  for (const team of teams) {
    if (human.has(team.id)) continue;
    const plan = planOf.get(team.id) ?? parsePlan(null);
    if (plan.projects.some((p) => p.status === "building")) continue;
    const last = plan.projects.reduce((m, p) => Math.max(m, new Date(p.startedOn).getTime()), 0);
    if (last && today.getTime() - last < AI_PROJECT_COOLDOWN_DAYS * DAY) continue;
    if (Math.random() >= chance) continue;
    if (await aiStartProject(careerId, team.id, leagueId, season, today, locale)) started++;
  }
  return started;
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { initialTrainingStaffLevel } from "@/lib/careers/finance-rules";
import {
  budgetIncreaseChance,
  BUDGET_INCREASE_RATE,
  generateStaffMember,
  generateStaffPool,
  generateTeamStaff,
  NEUTRAL_STAFF_PROFILE,
  renewalSalary,
  severanceCost,
  staffAfterSeason,
  staffBudget,
  staffProfile,
  staffSalary,
  staffSlots,
  staffValue,
  STAFF_ROLES,
  type AssistantSpecialty,
  type GeneratedStaff,
  type StaffProfile,
  type StaffRole,
} from "@/lib/careers/staff-rules";
import {
  budgetRequestMessageText,
  staffDepartureMessageText,
  staffSeasonBudgetMessageText,
} from "@/lib/careers/inbox-rules";
import type { Locale } from "@/lib/i18n/locale";

export interface StaffMemberView {
  id: string;
  teamId: string | null;
  role: StaffRole;
  specialty: AssistantSpecialty | null;
  firstName: string;
  lastName: string;
  age: number;
  rating: number;
  motivation: number | null;
  salary: number;
  yearsRemaining: number;
}

const POOL_SIZE: Record<string, number> = { nba: 45, wnba: 25 };
const POOL_REFRESH: Record<string, number> = { nba: 20, wnba: 12 };
const POOL_MAX: Record<string, number> = { nba: 90, wnba: 50 };

function toRow(careerId: string, teamId: string | null, s: GeneratedStaff, season: string | null) {
  return {
    careerId,
    teamId,
    role: s.role,
    specialty: s.specialty,
    firstName: s.firstName,
    lastName: s.lastName,
    age: s.age,
    rating: s.rating,
    motivation: s.motivation,
    salary: s.salary,
    yearsRemaining: teamId ? s.yearsRemaining : 0,
    hiredSeason: teamId ? season : null,
  };
}

// Crée le staff de toutes les équipes d'une carrière (et le marché des
// candidats) la première fois qu'on en a besoin — les carrières créées avant
// l'arrivée du staff y passent aussi. Verrou consultatif Postgres : deux
// requêtes simultanées ne génèrent jamais deux staffs.
export async function ensureCareerStaff(careerId: string, leagueId: string, season: string): Promise<void> {
  const existing = await prisma.staffMember.count({ where: { careerId } });
  if (existing > 0) {
    await ensureScouts(careerId, leagueId, season);
    return;
  }
  const teams = await prisma.team.findMany({ where: { leagueId }, select: { id: true, marketAppeal: true } });
  const states = await prisma.teamState.findMany({ where: { careerId }, select: { teamId: true, trainingStaffLevel: true } });
  const levelByTeam = new Map(states.map((s) => [s.teamId, s.trainingStaffLevel]));
  const rows = [
    ...teams.flatMap((team) =>
      generateTeamStaff(leagueId, levelByTeam.get(team.id) ?? initialTrainingStaffLevel(team.marketAppeal, team.id)).map((s) =>
        toRow(careerId, team.id, s, season)
      )
    ),
    ...generateStaffPool(leagueId, POOL_SIZE[leagueId] ?? POOL_SIZE.nba).map((s) => toRow(careerId, null, s, null)),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`staff:${careerId}`}))`;
    if ((await tx.staffMember.count({ where: { careerId } })) > 0) return;
    await tx.staffMember.createMany({ data: rows });
  });
}

// Recruteurs ajoutés après coup (carrières dont le staff existait déjà) :
// chaque équipe reçoit les siens à son niveau d'encadrement, et quelques
// candidats rejoignent le marché.
async function ensureScouts(careerId: string, leagueId: string, season: string): Promise<void> {
  if ((await prisma.staffMember.count({ where: { careerId, role: "scout" } })) > 0) return;
  const slots = staffSlots(leagueId).scout;
  const teams = await prisma.team.findMany({ where: { leagueId }, select: { id: true, marketAppeal: true } });
  const states = await prisma.teamState.findMany({ where: { careerId }, select: { teamId: true, trainingStaffLevel: true } });
  const levelByTeam = new Map(states.map((st) => [st.teamId, st.trainingStaffLevel]));
  const rows = [
    ...teams.flatMap((team) =>
      Array.from({ length: slots }, () =>
        toRow(
          careerId,
          team.id,
          generateStaffMember(leagueId, "scout", levelByTeam.get(team.id) ?? initialTrainingStaffLevel(team.marketAppeal, team.id)),
          season
        )
      )
    ),
    ...Array.from({ length: 8 }, () =>
      toRow(careerId, null, generateStaffMember(leagueId, "scout", 30 + Math.random() * 50), null)
    ),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`scouts:${careerId}`}))`;
    if ((await tx.staffMember.count({ where: { careerId, role: "scout" } })) > 0) return;
    await tx.staffMember.createMany({ data: rows });
  });
}

function toView(m: {
  id: string;
  teamId: string | null;
  role: string;
  specialty: string | null;
  firstName: string;
  lastName: string;
  age: number;
  rating: number;
  motivation: number | null;
  salary: number;
  yearsRemaining: number;
}): StaffMemberView {
  return {
    id: m.id,
    teamId: m.teamId,
    role: m.role as StaffRole,
    specialty: m.specialty as AssistantSpecialty | null,
    firstName: m.firstName,
    lastName: m.lastName,
    age: m.age,
    rating: m.rating,
    motivation: m.motivation,
    salary: m.salary,
    yearsRemaining: m.yearsRemaining,
  };
}

const ROLE_ORDER: Record<string, number> = { head_coach: 0, assistant_coach: 1, strength_coach: 2, medical: 3, scout: 4 };

export async function getTeamStaff(careerId: string, teamId: string): Promise<StaffMemberView[]> {
  const rows = await prisma.staffMember.findMany({ where: { careerId, teamId } });
  return rows.map(toView).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.rating - a.rating);
}

export async function getStaffMarket(careerId: string, role?: StaffRole): Promise<StaffMemberView[]> {
  const rows = await prisma.staffMember.findMany({
    where: { careerId, teamId: null, ...(role ? { role } : {}) },
    orderBy: { rating: "desc" },
  });
  return rows.map(toView);
}

// Profils de staff de plusieurs équipes en une requête (simulation d'un
// match : les deux équipes). Neutre (50 partout) tant que le staff de la
// carrière n'existe pas encore.
export async function getStaffProfiles(
  careerId: string,
  teamIds: string[],
  leagueId: string
): Promise<Map<string, StaffProfile>> {
  const rows = await prisma.staffMember.findMany({
    where: { careerId, teamId: { in: teamIds } },
    select: { teamId: true, role: true, specialty: true, rating: true, motivation: true },
  });
  const result = new Map<string, StaffProfile>();
  if (rows.length === 0) {
    for (const id of teamIds) result.set(id, NEUTRAL_STAFF_PROFILE);
    return result;
  }
  for (const id of teamIds) result.set(id, staffProfile(rows.filter((r) => r.teamId === id), leagueId));
  return result;
}

// Le niveau global d'encadrement reste mis en cache dans
// TeamState.trainingStaffLevel (lu par les promesses, l'attractivité pour
// les agents libres, la page GM).
async function syncStaffLevel(careerId: string, teamId: string, leagueId: string): Promise<void> {
  const profile = (await getStaffProfiles(careerId, [teamId], leagueId)).get(teamId)!;
  await prisma.teamState.updateMany({ where: { careerId, teamId }, data: { trainingStaffLevel: profile.overall } });
}

export interface StaffBudgetSummary {
  budget: number;
  committed: number;
  severance: number;
  available: number;
  canRequestIncrease: boolean;
}

// Budget de la saison (calculé et enregistré à la première lecture).
async function ensureBudget(careerId: string, teamId: string, leagueId: string): Promise<number> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  if (state.staffBudget > 0) return state.staffBudget;
  const [team, membership] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { marketAppeal: true } }),
    prisma.membership.findUnique({ where: { careerId_teamId: { careerId, teamId } }, include: { gmProfile: true } }),
  ]);
  const budget = staffBudget(leagueId, team?.marketAppeal ?? 50, membership?.gmProfile?.frontOfficeApproval ?? 50);
  await prisma.teamState.update({ where: { id: state.id }, data: { staffBudget: budget } });
  return budget;
}

export async function getStaffBudgetSummary(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string
): Promise<StaffBudgetSummary> {
  const budget = await ensureBudget(careerId, teamId, leagueId);
  const [state, payroll] = await Promise.all([
    getOrCreateTeamState(careerId, teamId, leagueId),
    prisma.staffMember.aggregate({ where: { careerId, teamId }, _sum: { salary: true } }),
  ]);
  const committed = payroll._sum.salary ?? 0;
  return {
    budget,
    committed,
    severance: state.staffSeverance,
    available: budget - committed - state.staffSeverance,
    canRequestIncrease: state.staffBudgetRequestSeason !== season,
  };
}

export type StaffActionError =
  | "notFound"
  | "notAvailable"
  | "noSlot"
  | "overBudget"
  | "notRenewable"
  | "alreadyRequested";

export async function hireStaff(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  staffId: string,
  years: number
): Promise<StaffActionError | null> {
  const member = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!member || member.careerId !== careerId) return "notFound";
  if (member.teamId) return "notAvailable";
  const slots = staffSlots(leagueId)[member.role as StaffRole] ?? 0;
  const filled = await prisma.staffMember.count({ where: { careerId, teamId, role: member.role } });
  if (filled >= slots) return "noSlot";
  const summary = await getStaffBudgetSummary(careerId, teamId, leagueId, season);
  if (member.salary > summary.available) return "overBudget";

  const claimed = await prisma.staffMember.updateMany({
    where: { id: staffId, teamId: null },
    data: { teamId, yearsRemaining: Math.max(1, Math.min(4, years)), hiredSeason: season },
  });
  if (claimed.count === 0) return "notAvailable";
  await syncStaffLevel(careerId, teamId, leagueId);
  return null;
}

// Licenciement : la moitié du salaire restant dû est payée en indemnités,
// imputées sur le budget staff de la saison. Le membre retourne sur le marché.
export async function fireStaff(
  careerId: string,
  teamId: string,
  leagueId: string,
  staffId: string
): Promise<StaffActionError | null> {
  const member = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!member || member.careerId !== careerId || member.teamId !== teamId) return "notFound";
  const severance = severanceCost(member.salary, member.yearsRemaining);
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  await prisma.$transaction([
    prisma.staffMember.update({
      where: { id: staffId },
      data: {
        teamId: null,
        yearsRemaining: 0,
        hiredSeason: null,
        salary: staffSalary(leagueId, member.role as StaffRole, member.rating),
      },
    }),
    prisma.teamState.update({ where: { id: state.id }, data: { staffSeverance: state.staffSeverance + severance } }),
  ]);
  await syncStaffLevel(careerId, teamId, leagueId);
  return null;
}

// Prolongation, possible pendant la dernière année de contrat.
export async function renewStaff(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  staffId: string,
  years: number
): Promise<StaffActionError | null> {
  const member = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!member || member.careerId !== careerId || member.teamId !== teamId) return "notFound";
  if (member.yearsRemaining > 1) return "notRenewable";
  const newSalary = renewalSalary(member.salary, member.rating);
  const summary = await getStaffBudgetSummary(careerId, teamId, leagueId, season);
  if (newSalary - member.salary > summary.available) return "overBudget";
  await prisma.staffMember.update({
    where: { id: staffId },
    data: { salary: newSalary, yearsRemaining: member.yearsRemaining + Math.max(1, Math.min(3, years)) },
  });
  return null;
}

// Demande de rallonge aux propriétaires (une par saison).
export async function requestBudgetIncrease(
  careerId: string,
  teamId: string,
  leagueId: string,
  season: string,
  locale: Locale
): Promise<{ error: StaffActionError | null; approved: boolean }> {
  const budget = await ensureBudget(careerId, teamId, leagueId);
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  if (state.staffBudgetRequestSeason === season) return { error: "alreadyRequested", approved: false };
  const membership = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
    include: { gmProfile: true },
  });
  const approved = Math.random() < budgetIncreaseChance(membership?.gmProfile?.frontOfficeApproval ?? 50);
  const step = leagueId === "wnba" ? 10_000 : 100_000;
  const newBudget = approved ? Math.round((budget * (1 + BUDGET_INCREASE_RATE)) / step) * step : budget;
  await prisma.teamState.update({
    where: { id: state.id },
    data: { staffBudget: newBudget, staffBudgetRequestSeason: season },
  });
  const msg = budgetRequestMessageText(locale, approved, newBudget);
  await createInboxMessage(careerId, teamId, season, "staff", msg.title, msg.body, "/staff");
  return { error: null, approved };
}

// ---------------------------------------------------------------------------
// IA

// Une équipe IA comble ses postes vacants avec le meilleur candidat
// abordable (en priorité la spécialité d'assistant qui lui manque).
async function aiFillVacancies(careerId: string, teamId: string, leagueId: string, season: string): Promise<void> {
  const slots = staffSlots(leagueId);
  const budget = await ensureBudget(careerId, teamId, leagueId);
  const staff = await prisma.staffMember.findMany({ where: { careerId, teamId } });
  let committed = staff.reduce((sum, m) => sum + m.salary, 0);
  for (const role of STAFF_ROLES) {
    let filled = staff.filter((m) => m.role === role).length;
    while (filled < slots[role]) {
      const haveSpecialties = new Set(staff.filter((m) => m.role === role).map((m) => m.specialty));
      const candidates = await prisma.staffMember.findMany({ where: { careerId, teamId: null, role } });
      const affordable = candidates.filter((c) => committed + c.salary <= budget * 1.05);
      const pool = affordable.length > 0 ? affordable : candidates.sort((a, b) => a.salary - b.salary).slice(0, 1);
      const best = pool.sort((a, b) => {
        const missing = (c: typeof a) => (role === "assistant_coach" && c.specialty && !haveSpecialties.has(c.specialty) ? 10 : 0);
        return staffValue(b, leagueId, role) + missing(b) - (staffValue(a, leagueId, role) + missing(a));
      })[0];
      if (!best) break;
      const claimed = await prisma.staffMember.updateMany({
        where: { id: best.id, teamId: null },
        data: { teamId, yearsRemaining: 1 + Math.floor(Math.random() * 3), hiredSeason: season },
      });
      if (claimed.count === 0) continue;
      staff.push({ ...best, teamId });
      committed += best.salary;
      filled++;
    }
  }
}

// ---------------------------------------------------------------------------
// Intersaison

// Appelée au passage à la saison suivante (season.ts) : vieillissement et
// retraites, fins de contrat (l'IA prolonge ses bons éléments, les membres
// du staff d'un GM humain non prolongés s'en vont), renouvellement du
// marché, nouveaux budgets, puis l'IA comble ses postes vacants.
export async function processStaffOffseason(
  careerId: string,
  leagueId: string,
  newSeason: string,
  winPctByTeam: Map<string, number>,
  locale: Locale
): Promise<void> {
  await ensureCareerStaff(careerId, leagueId, newSeason);
  const humanTeams = new Map(
    (await prisma.membership.findMany({ where: { careerId }, include: { gmProfile: true } })).map((m) => [m.teamId, m])
  );
  const all = await prisma.staffMember.findMany({ where: { careerId } });

  const departures = new Map<string, { name: string; reason: "retired" | "contract" }[]>();
  const noteDeparture = (teamId: string, name: string, reason: "retired" | "contract") => {
    if (!humanTeams.has(teamId)) return;
    departures.set(teamId, [...(departures.get(teamId) ?? []), { name, reason }]);
  };

  const deletes: string[] = [];
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  for (const m of all) {
    const next = staffAfterSeason(m);
    const name = `${m.firstName} ${m.lastName}`;
    if (next.retires) {
      deletes.push(m.id);
      if (m.teamId) noteDeparture(m.teamId, name, "retired");
      continue;
    }
    const data: Record<string, unknown> = { age: next.age, rating: next.rating, motivation: next.motivation };
    if (m.teamId) {
      const years = m.yearsRemaining - 1;
      if (years > 0) {
        data.yearsRemaining = years;
      } else if (!humanTeams.has(m.teamId) && m.rating >= 45 && Math.random() < 0.65) {
        // L'IA prolonge ses membres corrects.
        data.yearsRemaining = 1 + Math.floor(Math.random() * 3);
        data.salary = renewalSalary(m.salary, next.rating);
      } else {
        data.teamId = null;
        data.yearsRemaining = 0;
        data.hiredSeason = null;
        data.salary = staffSalary(leagueId, m.role as StaffRole, next.rating, 0.9 + Math.random() * 0.25);
        noteDeparture(m.teamId, name, "contract");
      }
    } else {
      data.salary = staffSalary(leagueId, m.role as StaffRole, next.rating, 0.9 + Math.random() * 0.25);
    }
    updates.push({ id: m.id, data });
  }
  if (deletes.length > 0) await prisma.staffMember.deleteMany({ where: { id: { in: deletes } } });
  for (let i = 0; i < updates.length; i += 100) {
    await prisma.$transaction(updates.slice(i, i + 100).map((u) => prisma.staffMember.update({ where: { id: u.id }, data: u.data })));
  }

  // Marché : nouveaux candidats, et on écarte les plus faibles au-delà du plafond.
  await prisma.staffMember.createMany({
    data: generateStaffPool(leagueId, POOL_REFRESH[leagueId] ?? POOL_REFRESH.nba).map((s) => toRow(careerId, null, s, null)),
  });
  const pool = await prisma.staffMember.findMany({ where: { careerId, teamId: null }, orderBy: { rating: "desc" } });
  const max = POOL_MAX[leagueId] ?? POOL_MAX.nba;
  if (pool.length > max) await prisma.staffMember.deleteMany({ where: { id: { in: pool.slice(max).map((p) => p.id) } } });

  // Budgets de la nouvelle saison.
  const teams = await prisma.team.findMany({ where: { leagueId }, select: { id: true, marketAppeal: true } });
  for (const team of teams) {
    const approval = humanTeams.get(team.id)?.gmProfile?.frontOfficeApproval ?? 50;
    const budget = staffBudget(leagueId, team.marketAppeal, approval, winPctByTeam.get(team.id) ?? 0.5);
    await prisma.teamState.updateMany({
      where: { careerId, teamId: team.id },
      data: { staffBudget: budget, staffSeverance: 0 },
    });
  }

  // L'IA comble ses postes, puis tout le monde met à jour son niveau d'encadrement.
  for (const team of teams) {
    if (!humanTeams.has(team.id)) await aiFillVacancies(careerId, team.id, leagueId, newSeason);
  }
  for (const team of teams) await syncStaffLevel(careerId, team.id, leagueId);

  // Boîte de réception des GM humains.
  for (const [teamId] of humanTeams) {
    const summary = await getStaffBudgetSummary(careerId, teamId, leagueId, newSeason);
    const budgetMsg = staffSeasonBudgetMessageText(locale, summary.budget, summary.committed);
    await createInboxMessage(careerId, teamId, newSeason, "staff", budgetMsg.title, budgetMsg.body, "/staff");
    for (const d of departures.get(teamId) ?? []) {
      const msg = staffDepartureMessageText(locale, d.name, d.reason);
      await createInboxMessage(careerId, teamId, newSeason, "staff", msg.title, msg.body, "/staff");
    }
  }
}

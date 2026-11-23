import "server-only";
import { prisma } from "@/lib/prisma";
import { EUROPE_CONTRACTS, playersEurope } from "@/lib/mock-data/players-europe";
import { generateCareerPlayerStates } from "@/lib/careers/generate-player-states";
import { buyoutFor, europeAfterSeason } from "@/lib/careers/europe-rules";
import { addUpgradeToLedger } from "@/lib/data-access/finance";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { healthyFinancesThreshold } from "@/lib/careers/finance-rules";
import { checkSalaryMove, midLevelLimit } from "@/lib/careers/cap-rules";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { minAcceptableSalary } from "@/lib/careers/player-demands";
import { translatorFor } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { formatSalary } from "@/lib/utils";

// Joueurs d'Europe : état initial dans une carrière, rachat de contrat,
// fin de saison européenne — voir europe-rules.ts.

// Place les joueurs du catalogue européen « en Europe » dans une carrière
// (club, années, clause de rachat). Crée leurs états s'ils manquent
// (carrières créées avant l'ajout des joueurs d'Europe). À n'appeler qu'à la
// création de la carrière (ou une fois pour une carrière existante).
export async function applyEuropeStates(careerId: string): Promise<number> {
  const ids = playersEurope.map((p) => p.id);
  const [existing, contracts] = await Promise.all([
    prisma.playerState.findMany({ where: { careerId, playerId: { in: ids } }, select: { playerId: true } }),
    prisma.contract.findMany({ where: { careerId, playerId: { in: ids } }, select: { playerId: true } }),
  ]);
  const have = new Set(existing.map((s) => s.playerId));
  const missing = playersEurope.filter((p) => !have.has(p.id));
  if (missing.length > 0) {
    const inDb = new Set((await prisma.player.findMany({ where: { id: { in: missing.map((p) => p.id) } }, select: { id: true } })).map((p) => p.id));
    await generateCareerPlayerStates(careerId, missing.filter((p) => inDb.has(p.id)));
  }
  const signed = new Set(contracts.map((c) => c.playerId));
  let n = 0;
  for (const p of playersEurope) {
    if (signed.has(p.id)) continue;
    const c = EUROPE_CONTRACTS[p.id];
    if (!c) continue;
    const r = await prisma.playerState.updateMany({
      where: { careerId, playerId: p.id },
      data: { abroadClub: c.club, abroadYears: c.years, buyout: buyoutFor(p.overallRating, p.age, c.years), rightsTeamId: null },
    });
    n += r.count;
  }
  return n;
}

export type BuyoutResult = { ok: true; amount: number } | { ok: false; error: "notAbroad" | "rights" | "funds" | "unknown" };

// Rachat du contrat européen : l'équipe paie la clause (trésorerie) et
// obtient les droits exclusifs du joueur, qui peut alors négocier avec elle.
export async function payBuyout(careerId: string, teamId: string, playerId: string, season: string): Promise<BuyoutResult> {
  const [state, teamState] = await Promise.all([
    prisma.playerState.findUnique({ where: { careerId_playerId: { careerId, playerId } } }),
    prisma.teamState.findFirst({ where: { careerId, teamId } }),
  ]);
  if (!state || !teamState) return { ok: false, error: "unknown" };
  if (!state.abroadClub) return { ok: false, error: "notAbroad" };
  if (state.rightsTeamId && state.rightsTeamId !== teamId) return { ok: false, error: "rights" };
  if (teamState.finances < state.buyout) return { ok: false, error: "funds" };
  await prisma.$transaction([
    prisma.teamState.update({
      where: { id: teamState.id },
      data: { finances: teamState.finances - state.buyout, financeLedgerJson: addUpgradeToLedger(teamState.financeLedgerJson, season, state.buyout) },
    }),
    prisma.playerState.update({ where: { id: state.id }, data: { abroadClub: null, abroadYears: 0, buyout: 0, rightsTeamId: teamId } }),
  ]);
  return { ok: true, amount: state.buyout };
}

// Intersaison : une saison de plus en Europe pour ceux qui y jouent
// (renouvellement en fin de contrat, nouvelle clause) ; les droits d'un
// joueur racheté mais jamais signé s'éteignent (il redevient agent libre).
export async function europeOffseason(careerId: string): Promise<void> {
  const abroad = await prisma.playerState.findMany({ where: { careerId, abroadClub: { not: null }, retired: false } });
  for (const s of abroad) {
    const next = europeAfterSeason({ overall: s.overallRating, age: s.age, years: s.abroadYears });
    await prisma.playerState.update({ where: { id: s.id }, data: { abroadYears: next.years, buyout: next.buyout } });
  }
  const unsigned = await prisma.playerState.findMany({ where: { careerId, abroadClub: null, rightsTeamId: { not: null } }, select: { id: true, playerId: true } });
  const contracted = new Set(
    (await prisma.contract.findMany({ where: { careerId, playerId: { in: unsigned.map((u) => u.playerId) } }, select: { playerId: true } })).map((c) => c.playerId)
  );
  const lapsed = unsigned.filter((u) => !contracted.has(u.playerId)).map((u) => u.id);
  if (lapsed.length) await prisma.playerState.updateMany({ where: { id: { in: lapsed } }, data: { rightsTeamId: null } });
}

// Intersaison (période des agents libres) : des équipes IA qui ont besoin
// de joueurs vont chercher un joueur d'Europe — rachat payé, contrat signé,
// annonce dans l'actualité. Elles rapatrient aussi leurs jeunes laissés en
// Europe une fois prêts.
export async function aiEuropeSignings(careerId: string, leagueId: string, season: string, target: number, locale: Locale, maxSignings = 3): Promise<number> {
  const [teams, humans, league, abroad] = await Promise.all([
    prisma.team.findMany({ where: { leagueId }, select: { id: true, city: true, name: true } }),
    prisma.membership.findMany({ where: { careerId }, select: { teamId: true } }),
    prisma.league.findUnique({ where: { id: leagueId }, select: { salaryCap: true } }),
    prisma.playerState.findMany({
      where: { careerId, abroadClub: { not: null }, retired: false },
      include: { player: { select: { firstName: true, lastName: true } } },
      orderBy: { overallRating: "desc" },
    }),
  ]);
  if (abroad.length === 0) return 0;
  const human = new Set(humans.map((h) => h.teamId));
  const counts = new Map(
    (await prisma.contract.groupBy({ by: ["teamId"], where: { careerId, contractType: "standard" }, _count: true })).map((c) => [c.teamId, c._count])
  );
  // Niveau du joueur le plus faible de chaque effectif : un Européen vient
  // RENFORCER l'équipe (pas seulement combler un trou).
  const std = await prisma.contract.findMany({ where: { careerId, contractType: "standard" }, select: { teamId: true, playerId: true } });
  const ovr = new Map(
    (await prisma.playerState.findMany({ where: { careerId, playerId: { in: std.map((c) => c.playerId) } }, select: { playerId: true, overallRating: true } })).map((s) => [s.playerId, s.overallRating])
  );
  const worstOf = new Map<string, number>();
  for (const c of std) worstOf.set(c.teamId, Math.min(worstOf.get(c.teamId) ?? 99, ovr.get(c.playerId) ?? 99));
  const maxRoster = 15;
  const reserve = healthyFinancesThreshold(leagueId);
  const t = translatorFor(locale);
  let signed = 0;
  for (const team of [...teams].sort(() => Math.random() - 0.5)) {
    const size = counts.get(team.id) ?? 0;
    if (signed >= maxSignings || human.has(team.id) || size >= maxRoster) continue;
    if (Math.random() >= (size < target ? 0.5 : 0.25)) continue;
    // Ses propres jeunes d'abord (prêts : 70+ ou 22 ans), sinon un bon joueur
    // libre de droits, meilleur que le plus faible de l'effectif.
    const worst = worstOf.get(team.id) ?? 60;
    const candidate =
      abroad.find((s) => s.rightsTeamId === team.id && (s.overallRating >= 70 || s.age >= 22)) ??
      abroad.find((s) => !s.rightsTeamId && s.overallRating >= 72 && s.overallRating >= worst + 2 && s.age <= 33);
    if (!candidate) continue;
    const [state, payroll] = await Promise.all([prisma.teamState.findFirst({ where: { careerId, teamId: team.id } }), getPayrollForTeam(careerId, team.id)]);
    if (!state || state.finances - candidate.buyout < reserve) continue;
    // Exception de mi-niveau : signable au-dessus du plafond (le joueur
    // accepte ce montant pour venir en NBA).
    const contract = generateContractTerms(candidate.overallRating, leagueId);
    const base = {
      salary: Math.max(contract.salary, minAcceptableSalary(candidate.renown, candidate.overallRating, leagueId)),
      yearsRemaining: contract.yearsRemaining,
    };
    const salary = Math.min(base.salary, payroll + base.salary > (league?.salaryCap ?? Infinity) ? midLevelLimit(payroll + base.salary) : base.salary);
    if (!checkSalaryMove(leagueId, league?.salaryCap ?? Infinity, "international", payroll + salary, salary).ok) continue;
    const terms = { salary, yearsRemaining: base.yearsRemaining };
    await prisma.$transaction([
      prisma.teamState.update({ where: { id: state.id }, data: { finances: state.finances - candidate.buyout, financeLedgerJson: addUpgradeToLedger(state.financeLedgerJson, season, candidate.buyout) } }),
      prisma.contract.create({ data: { careerId, playerId: candidate.playerId, teamId: team.id, salary: terms.salary, yearsRemaining: terms.yearsRemaining, guaranteed: true } }),
      prisma.playerTeamStint.create({ data: { careerId, playerId: candidate.playerId, teamId: team.id, season, reason: "signed" } }),
      prisma.playerState.update({ where: { id: candidate.id }, data: { abroadClub: null, abroadYears: 0, buyout: 0, rightsTeamId: null } }),
    ]);
    const name = `${candidate.player.firstName} ${candidate.player.lastName}`;
    await prisma.leagueNews.create({
      data: {
        careerId,
        season,
        type: "trade",
        teamId: team.id,
        title: t("europe.news.title", { player: name, team: `${team.city} ${team.name}` }),
        body: t("europe.news.body", {
          player: name,
          club: candidate.abroadClub ?? "",
          team: `${team.city} ${team.name}`,
          buyout: formatSalary(candidate.buyout, locale),
          salary: formatSalary(terms.salary, locale),
        }),
      },
    });
    abroad.splice(abroad.indexOf(candidate), 1);
    counts.set(team.id, (counts.get(team.id) ?? 0) + 1);
    signed++;
  }
  return signed;
}

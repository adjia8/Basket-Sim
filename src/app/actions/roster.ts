"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { generateContractTerms } from "@/lib/careers/generate-contracts";
import { getLeagueById } from "@/lib/data-access/leagues";
import { getPayrollForTeam } from "@/lib/data-access/contracts";
import { getStandings } from "@/lib/data-access/standings";
import { getTeamById } from "@/lib/data-access/teams";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { isFreeAgencyOpen } from "@/lib/data-access/season-windows";
import { recordTeamStint } from "@/lib/data-access/player-history";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { initialRenown } from "@/lib/careers/renown-rules";
import {
  minAcceptableSalary,
  teamMeetsPlayerDemands,
  winPctForStandings,
} from "@/lib/careers/player-demands";
import {
  ALT_CONTRACT_SALARY,
  ALT_CONTRACT_SLOTS_PER_TEAM,
  ALT_CONTRACT_TYPE,
  EXTENSION_MAX_OFFER_YEARS,
  EXTENSION_MAX_YEARS_REMAINING,
  EXTENSION_MIN_OFFER_YEARS,
  isEligibleForAlternateContract,
} from "@/lib/careers/contract-type-rules";
import { getTranslator } from "@/lib/i18n/translate";
import { formatSalary } from "@/lib/utils";

function revalidateRosterPaths(teamId: string) {
  revalidatePath("/");
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/free-agents");
}

export async function releasePlayer(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  // On ne peut libérer qu'un joueur sous contrat avec SON PROPRE effectif.
  if (!contract || contract.teamId !== membership.teamId) return;

  // Seuls les contrats standard comptent pour le minimum d'effectif — les
  // contrats alternatifs (two-way/développement) sont des slots à part.
  const rosterSize = await prisma.contract.count({
    where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
  });
  const minRosterSize = MIN_ROSTER_SIZE[membership.career.leagueId] ?? MIN_ROSTER_SIZE.nba;
  if (contract.contractType === "standard" && rosterSize <= minRosterSize) return;

  await prisma.$transaction([
    prisma.contract.delete({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    // Un contrat garanti coupé avant terme laisse de l'argent mort qui
    // continue de compter dans le plafond de l'équipe — un contrat de 2e
    // tour de draft (non garanti) n'en laisse aucun.
    ...(contract.guaranteed
      ? [
          prisma.deadCap.create({
            data: {
              careerId: membership.careerId,
              teamId: membership.teamId,
              playerId,
              salary: contract.salary,
              yearsRemaining: contract.yearsRemaining,
            },
          }),
        ]
      : []),
  ]);

  revalidateRosterPaths(membership.teamId);
}

export async function signFreeAgent(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const [player, playerState, existingContract, rosterSize, currentPayroll, league, standings, myTeam, myTeamState] =
    await Promise.all([
      prisma.player.findUnique({ where: { id: playerId } }),
      prisma.playerState.findUnique({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
      }),
      prisma.contract.findUnique({
        where: { careerId_playerId: { careerId: membership.careerId, playerId } },
      }),
      // Seuls les contrats standard comptent pour le plafond d'effectif — les
      // contrats alternatifs (two-way/développement) sont des slots à part.
      prisma.contract.count({
        where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
      }),
      getPayrollForTeam(membership.careerId, membership.teamId),
      getLeagueById(membership.career.leagueId),
      getStandings(membership.careerId, membership.career.leagueId, membership.career.season),
      getTeamById(membership.teamId),
      getOrCreateTeamState(membership.careerId, membership.teamId, membership.career.leagueId),
    ]);

  if (!player || player.leagueId !== membership.career.leagueId) return;
  if (existingContract) return; // déjà sous contrat dans cette Career
  const maxRosterSize = MAX_ROSTER_SIZE[membership.career.leagueId] ?? MAX_ROSTER_SIZE.nba;
  if (rosterSize >= maxRosterSize) return;
  if (!(await isFreeAgencyOpen(membership.careerId, membership.career.season))) return;
  if (!myTeam) return;

  const renown = playerState?.renown ?? initialRenown(player.overallRating);
  const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);
  const teamWinPct = winPctForStandings(myStandingsRow?.wins ?? 0, myStandingsRow?.losses ?? 0);
  if (
    !teamMeetsPlayerDemands({
      renown,
      teamWinPct,
      teamMarketAppeal: myTeam.marketAppeal,
      teamFacilitiesLevel: myTeamState.facilitiesLevel,
    })
  ) {
    return; // refuse : équipe pas assez compétitive, marché pas assez attractif, et/ou infrastructures insuffisantes
  }

  // Calculée une seule fois : generateContractTerms tire un salaire aléatoire,
  // la réutiliser pour la vérification du cap ET l'insertion évite un montant
  // vérifié différent du montant réellement facturé. Le renommé impose un
  // plancher salarial en plus de ce que suggérerait le seul overall.
  const terms = generateContractTerms(player.overallRating, membership.career.leagueId);
  const salary = Math.max(
    terms.salary,
    minAcceptableSalary(renown, player.overallRating, membership.career.leagueId)
  );
  const salaryCap = league?.salaryCap ?? Infinity;
  if (currentPayroll + salary > salaryCap) return;

  try {
    await prisma.contract.create({
      data: {
        careerId: membership.careerId,
        playerId,
        teamId: membership.teamId,
        ...terms,
        salary,
      },
    });
  } catch (err) {
    // P2002 : un autre manager a signé ce joueur entre-temps (@@unique([careerId, playerId])).
    if (err instanceof Error && "code" in err && err.code === "P2002") return;
    throw err;
  }
  await recordTeamStint(membership.careerId, playerId, membership.teamId, membership.career.season, "signed");

  revalidateRosterPaths(membership.teamId);
}

// Choix explicite du manager de faire jouer un joueur malgré une blessure
// mineure (au risque d'une récupération de conditionnement plus lente,
// d'une aggravation ou d'une nouvelle blessure — voir advanceRosterInjuries).
// Seulement valable pour SON PROPRE effectif et une blessure "minor" active.
export async function setPlayingThroughInjury(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");
  const value = formData.get("value") === "true";

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;

  const state = await prisma.playerState.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!state || !state.injured || state.injurySeverity !== "minor") return;

  await prisma.playerState.update({
    where: { id: state.id },
    data: { playingThroughInjury: value },
  });

  revalidateRosterPaths(membership.teamId);
}

export interface ExtendContractFormState {
  error?: string;
  success?: string;
}

// Prolongation d'un contrat standard proche de son terme (fenêtre simplifiée :
// EXTENSION_MAX_YEARS_REMAINING années ou moins restantes, sinon pas encore
// éligible). Le GM propose lui-même salaire + durée ; le joueur accepte ou
// refuse selon ses exigences (même barème que la signature d'agent libre) —
// sauf s'il est encore sous son contrat rookie (isRookieScale), auquel cas il
// n'a aucun levier de négociation salariale et accepte toute offre valide.
export async function extendContract(
  _prevState: ExtendContractFormState | undefined,
  formData: FormData
): Promise<ExtendContractFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");
  const salary = Math.round(Number(formData.get("salary")));
  const years = Math.round(Number(formData.get("years")));

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return { error: t("rosterAction.contractNotFound") };
  if (contract.contractType !== "standard") return { error: t("rosterAction.onlyStandardExtendable") };
  if (contract.yearsRemaining > EXTENSION_MAX_YEARS_REMAINING) {
    return { error: t("rosterAction.notYetEligible") };
  }
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    !Number.isInteger(years) ||
    years < EXTENSION_MIN_OFFER_YEARS ||
    years > EXTENSION_MAX_OFFER_YEARS
  ) {
    return { error: t("rosterAction.invalidOffer") };
  }

  const [player, playerState, currentPayroll, league, standings, myTeam, myTeamState] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.career.leagueId),
    getStandings(membership.careerId, membership.career.leagueId, membership.career.season),
    getTeamById(membership.teamId),
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.career.leagueId),
  ]);
  if (!player || !myTeam) return { error: t("rosterAction.dataNotFound") };

  const playerName = `${player.firstName} ${player.lastName}`;
  const salaryCap = league?.salaryCap ?? Infinity;
  // L'ancien salaire de ce joueur est déjà compté dans currentPayroll (contrat
  // standard) — on le retire avant d'ajouter le nouveau montant proposé.
  if (currentPayroll - contract.salary + salary > salaryCap) {
    return { error: t("rosterAction.exceedsCap", { cap: formatSalary(salaryCap, locale) }) };
  }

  const overallRating = playerState?.overallRating ?? player.overallRating;
  const renown = playerState?.renown ?? initialRenown(player.overallRating);

  if (!contract.isRookieScale) {
    const myStandingsRow = standings.find((row) => row.teamId === membership.teamId);
    const teamWinPct = winPctForStandings(myStandingsRow?.wins ?? 0, myStandingsRow?.losses ?? 0);
    if (
      !teamMeetsPlayerDemands({
        renown,
        teamWinPct,
        teamMarketAppeal: myTeam.marketAppeal,
        teamFacilitiesLevel: myTeamState.facilitiesLevel,
      })
    ) {
      return { error: t("rosterAction.refusesToNegotiate", { player: playerName }) };
    }

    const floor = minAcceptableSalary(renown, overallRating, membership.career.leagueId);
    if (salary < floor) {
      return {
        error: t("rosterAction.refusesOffer", { player: playerName, amount: formatSalary(floor, locale) }),
      };
    }
  }
  // Contrat rookie encore en cours : aucune exigence salariale, le joueur
  // accepte toute offre valide (plafond respecté) sans pouvoir en demander plus.

  await prisma.contract.update({
    where: { id: contract.id },
    data: { salary, yearsRemaining: years, guaranteed: true, isRookieScale: false },
  });

  revalidateRosterPaths(membership.teamId);
  return {
    success: t(years > 1 ? "rosterAction.acceptedMany" : "rosterAction.acceptedOne", {
      player: playerName,
      amount: formatSalary(salary, locale),
      years,
    }),
  };
}

// Convertit un contrat standard en contrat alternatif (two-way NBA /
// développement WNBA) : salaire fixe bas, non garanti, exclu du plafond
// salarial et du roster standard — seulement pour un joueur éligible
// (approximé par l'âge) et si l'équipe a encore un slot alternatif dispo.
export async function offerAlternateContract(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return;

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return;
  if (contract.contractType !== "standard") return;

  const [player, playerState, altSlotsUsed] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.contract.count({
      where: {
        careerId: membership.careerId,
        teamId: membership.teamId,
        contractType: { not: "standard" },
      },
    }),
  ]);
  if (!player) return;
  if (!isEligibleForAlternateContract(playerState?.age ?? player.age)) return;
  if (altSlotsUsed >= ALT_CONTRACT_SLOTS_PER_TEAM) return;

  const altType = ALT_CONTRACT_TYPE[membership.career.leagueId];
  if (!altType) return;

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      contractType: altType,
      salary: ALT_CONTRACT_SALARY[membership.career.leagueId] ?? contract.salary,
      yearsRemaining: 1,
      guaranteed: false,
      developmentGamesActivated: 0,
    },
  });

  revalidateRosterPaths(membership.teamId);
}

export interface PromoteContractFormState {
  error?: string;
  success?: string;
}

// Repasse un contrat alternatif (two-way NBA / développement WNBA) en
// contrat standard — seul moyen de lever le blocage d'activation à
// DEVELOPMENT_CONTRACT_GAME_LIMIT matchs d'une joueuse en développement (voir
// simulate-game/route.ts), mais utilisable aussi proactivement à tout
// moment. Le contrat alternatif ne portait qu'un salaire symbolique : un
// nouveau salaire standard est généré (même barème que la signature d'agent
// libre).
export async function promoteToStandardContract(
  _prevState: PromoteContractFormState | undefined,
  formData: FormData
): Promise<PromoteContractFormState> {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const playerId = String(formData.get("playerId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true },
  });
  if (!membership) return { error: t("rosterAction.noCareer") };

  const contract = await prisma.contract.findUnique({
    where: { careerId_playerId: { careerId: membership.careerId, playerId } },
  });
  if (!contract || contract.teamId !== membership.teamId) return { error: t("rosterAction.contractNotFound") };
  if (contract.contractType === "standard") return { error: t("rosterAction.alreadyStandard") };

  const [player, playerState, standardRosterSize, currentPayroll, league] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerState.findUnique({
      where: { careerId_playerId: { careerId: membership.careerId, playerId } },
    }),
    prisma.contract.count({
      where: { careerId: membership.careerId, teamId: membership.teamId, contractType: "standard" },
    }),
    getPayrollForTeam(membership.careerId, membership.teamId),
    getLeagueById(membership.career.leagueId),
  ]);
  if (!player) return { error: t("rosterAction.dataNotFound") };

  const maxRosterSize = MAX_ROSTER_SIZE[membership.career.leagueId] ?? MAX_ROSTER_SIZE.nba;
  if (standardRosterSize >= maxRosterSize) return { error: t("rosterAction.noStandardRoom") };

  const renown = playerState?.renown ?? initialRenown(player.overallRating);
  const overallRating = playerState?.overallRating ?? player.overallRating;
  const terms = generateContractTerms(overallRating, membership.career.leagueId);
  const salary = Math.max(terms.salary, minAcceptableSalary(renown, overallRating, membership.career.leagueId));
  const salaryCap = league?.salaryCap ?? Infinity;
  // Un contrat alternatif est déjà exclu du plafond (voir getPayrollForTeam) :
  // pas besoin de retirer son ancien salaire de currentPayroll avant d'ajouter
  // le nouveau, contrairement à extendContract sur un contrat standard.
  if (currentPayroll + salary > salaryCap) {
    return { error: t("rosterAction.exceedsCap", { cap: formatSalary(salaryCap, locale) }) };
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      contractType: "standard",
      salary,
      yearsRemaining: terms.yearsRemaining,
      guaranteed: true,
      developmentGamesActivated: 0,
    },
  });

  revalidateRosterPaths(membership.teamId);
  return {
    success: t("rosterAction.promoted", {
      player: `${player.firstName} ${player.lastName}`,
      amount: formatSalary(salary, locale),
    }),
  };
}

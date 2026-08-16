import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamState } from "@prisma/client";
import type { Player } from "@/lib/types";
import { chemistryTarget, nextChemistry } from "@/lib/careers/chemistry-rules";
import { attendanceTarget, nextAttendance } from "@/lib/careers/attendance-rules";
import {
  ANNUAL_DEGRADATION,
  clampFacilityLevel,
  UPGRADE_INCREMENT,
  initialFacilityLevel,
  initialFinances,
  initialTrainingStaffLevel,
  seasonRevenue,
  upgradeCost,
} from "@/lib/careers/finance-rules";

// Lecture paresseuse : crée la ligne à la valeur par défaut (chimie 50,
// trésorerie/infrastructures/personnel amorcés selon la ligue ET
// l'attractivité de marché de l'équipe — voir initialFinances/
// initialFacilityLevel/initialTrainingStaffLevel, chacune avec une variation
// déterministe par équipe pour éviter que toutes les franchises démarrent
// identiques) si elle n'existe pas encore pour cette Career/équipe — même
// principe que getCurrentDraftPick. Gère la course concurrente (deux
// managers déclenchant la création au même instant) via le même repli P2002
// que signFreeAgent.
export async function getOrCreateTeamState(
  careerId: string,
  teamId: string,
  leagueId: string
): Promise<TeamState> {
  const existing = await prisma.teamState.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
  });
  if (existing) return existing;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  const marketAppeal = team?.marketAppeal ?? 50;
  const finances = initialFinances(leagueId, marketAppeal);
  const facilitiesLevel = initialFacilityLevel(marketAppeal, teamId);
  const trainingStaffLevel = initialTrainingStaffLevel(marketAppeal, teamId);
  try {
    return await prisma.teamState.create({
      data: { careerId, teamId, finances, facilitiesLevel, trainingStaffLevel },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      const row = await prisma.teamState.findUnique({
        where: { careerId_teamId: { careerId, teamId } },
      });
      if (row) return row;
    }
    throw err;
  }
}

// Appelé juste après la résolution d'un match, pour chaque équipe : fait
// dériver la chimie vers sa cible (bilan + QI basket moyen du roster).
export async function advanceTeamChemistry(
  careerId: string,
  teamId: string,
  leagueId: string,
  winPct: number,
  roster: Player[],
  trainingBonus = 0
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  const averageBasketballIQ = roster.length
    ? roster.reduce((sum, p) => sum + p.ratings.basketballIQ, 0) / roster.length
    : 50;
  const target = chemistryTarget(winPct, averageBasketballIQ);
  const chemistry = Math.max(0, Math.min(99, nextChemistry(state.chemistry, target) + trainingBonus));

  await prisma.teamState.update({
    where: { id: state.id },
    data: { chemistry },
  });
}

// Appelé juste après la résolution d'un match, pour chaque équipe (humaine
// ou IA, comme la chimie) : fait dériver l'affluence vers sa cible, dominée
// par le bilan de l'équipe (voir attendance-rules.ts).
export async function advanceAttendance(
  careerId: string,
  teamId: string,
  leagueId: string,
  winPct: number,
  marketAppeal: number
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  const target = attendanceTarget(winPct, marketAppeal, state.facilitiesLevel);
  const attendance = nextAttendance(state.attendance, target);

  await prisma.teamState.update({
    where: { id: state.id },
    data: { attendance },
  });
}

// Appelé une fois par équipe au rollover de saison (src/app/actions/season.ts) :
// encaisse le revenu de la saison qui vient de se terminer (bilan + marché),
// puis dégrade les infrastructures/personnel si non réinvestis.
export async function applySeasonFinancials(
  careerId: string,
  teamId: string,
  leagueId: string,
  winPct: number,
  marketAppeal: number
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  const revenue = seasonRevenue(leagueId, winPct, marketAppeal, state.publicOpinion);

  await prisma.teamState.update({
    where: { id: state.id },
    data: {
      finances: state.finances + revenue,
      facilitiesLevel: clampFacilityLevel(state.facilitiesLevel - ANNUAL_DEGRADATION),
      trainingStaffLevel: clampFacilityLevel(state.trainingStaffLevel - ANNUAL_DEGRADATION),
    },
  });
}

// Achète UPGRADE_INCREMENT points sur la composante choisie si la trésorerie
// le permet — retourne false sans rien modifier sinon (le manager n'a pas
// assez de fonds).
export async function upgradeFacility(
  careerId: string,
  teamId: string,
  leagueId: string,
  component: "facilities" | "trainingStaff"
): Promise<boolean> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  const currentLevel = component === "facilities" ? state.facilitiesLevel : state.trainingStaffLevel;
  const cost = upgradeCost(currentLevel, leagueId);
  if (state.finances < cost) return false;

  await prisma.teamState.update({
    where: { id: state.id },
    data: {
      finances: state.finances - cost,
      ...(component === "facilities"
        ? { facilitiesLevel: clampFacilityLevel(currentLevel + UPGRADE_INCREMENT) }
        : { trainingStaffLevel: clampFacilityLevel(currentLevel + UPGRADE_INCREMENT) }),
    },
  });
  return true;
}

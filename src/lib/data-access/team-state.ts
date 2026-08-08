import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamState } from "@prisma/client";
import type { Player } from "@/lib/types";
import { chemistryTarget, nextChemistry } from "@/lib/careers/chemistry-rules";
import {
  ANNUAL_DEGRADATION,
  clampFacilityLevel,
  INITIAL_FINANCES,
  UPGRADE_INCREMENT,
  seasonRevenue,
  upgradeCost,
} from "@/lib/careers/finance-rules";

// Lecture paresseuse : crée la ligne à la valeur par défaut (chimie 50,
// infrastructures/personnel 50, trésorerie amorcée selon la ligue) si elle
// n'existe pas encore pour cette Career/équipe — même principe que
// getCurrentDraftPick. Gère la course concurrente (deux managers déclenchant
// la création au même instant) via le même repli P2002 que signFreeAgent.
export async function getOrCreateTeamState(
  careerId: string,
  teamId: string,
  leagueId: string
): Promise<TeamState> {
  const existing = await prisma.teamState.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
  });
  if (existing) return existing;

  const initialFinances = INITIAL_FINANCES[leagueId] ?? INITIAL_FINANCES.nba;
  try {
    return await prisma.teamState.create({
      data: { careerId, teamId, finances: initialFinances },
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
  roster: Player[]
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId, leagueId);
  const averageBasketballIQ = roster.length
    ? roster.reduce((sum, p) => sum + p.ratings.basketballIQ, 0) / roster.length
    : 50;
  const target = chemistryTarget(winPct, averageBasketballIQ);
  const chemistry = nextChemistry(state.chemistry, target);

  await prisma.teamState.update({
    where: { id: state.id },
    data: { chemistry },
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
  const revenue = seasonRevenue(leagueId, winPct, marketAppeal);

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

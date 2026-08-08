import "server-only";
import { prisma } from "@/lib/prisma";
import type { TeamState } from "@prisma/client";
import type { Player } from "@/lib/types";
import { chemistryTarget, nextChemistry } from "@/lib/careers/chemistry-rules";

// Lecture paresseuse : crée la ligne à la valeur par défaut (chimie 50) si
// elle n'existe pas encore pour cette Career/équipe — même principe que
// getCurrentDraftPick. Gère la course concurrente (deux managers déclenchant
// la création au même instant) via le même repli P2002 que signFreeAgent.
export async function getOrCreateTeamState(
  careerId: string,
  teamId: string
): Promise<TeamState> {
  const existing = await prisma.teamState.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
  });
  if (existing) return existing;

  try {
    return await prisma.teamState.create({ data: { careerId, teamId } });
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
  winPct: number,
  roster: Player[]
): Promise<void> {
  const state = await getOrCreateTeamState(careerId, teamId);
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

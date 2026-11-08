"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { parseTactics } from "@/lib/careers/tactics-rules";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";

// Enregistre la tactique de MON équipe (les valeurs inconnues retombent sur
// la tactique équilibrée, voir parseTactics).
export async function setTactics(formData: FormData): Promise<void> {
  const m = await getCurrentMembership();
  const tactics = parseTactics(
    JSON.stringify({
      pace: formData.get("pace"),
      offense: formData.get("offense"),
      defense: formData.get("defense"),
      depth: formData.get("depth"),
    })
  );
  const state = await getOrCreateTeamState(m.careerId, m.teamId, m.leagueId);
  await prisma.teamState.update({ where: { id: state.id }, data: { tacticsJson: JSON.stringify(tactics) } });
  revalidatePath(`/teams/${m.teamId}`);
  revalidatePath("/game", "layout");
}

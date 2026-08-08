import "server-only";
import { prisma } from "@/lib/prisma";
import { gmChemistryBonus, gmStrengthBonus } from "@/lib/careers/gm-rules";

export interface GmBonus {
  strength: number;
  chemistry: number;
}

const NO_BONUS: GmBonus = { strength: 0, chemistry: 0 };

// Équipe gérée par l'IA (pas de Membership) → aucun bonus. Sinon, dérivé de
// la répartition de points du GM à sa création (voir gm-rules.ts) — pas de
// dérive dans le temps, contrairement au bonus d'entraînement.
export async function getGmBonusForTeam(careerId: string, teamId: string): Promise<GmBonus> {
  const membership = await prisma.membership.findUnique({
    where: { careerId_teamId: { careerId, teamId } },
    include: { gmProfile: true },
  });
  const gm = membership?.gmProfile;
  if (!gm) return NO_BONUS;

  return {
    strength: gmStrengthBonus({
      offense: gm.offensePoints,
      defense: gm.defensePoints,
      physical: gm.physicalPoints,
      tactical: gm.tacticalPoints,
    }),
    chemistry: gmChemistryBonus(gm.chemistryPoints),
  };
}

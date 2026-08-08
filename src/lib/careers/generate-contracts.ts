import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { SALARY_RANGES, salaryForRating } from "./salary-rules";
import { minAcceptableSalary } from "./player-demands";

// Réutilisé à la fois pour la génération en masse (création de Career) et pour
// la signature ponctuelle d'un agent libre : même barème dans les deux cas.
export function generateContractTerms(
  overallRating: number,
  leagueId: string
): { salary: number; yearsRemaining: number; guaranteed: boolean } {
  const range = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  return {
    salary: salaryForRating(overallRating, range),
    yearsRemaining: 1 + Math.floor(Math.random() * 4), // 1 à 4
    guaranteed: true, // contrats vétérans toujours garantis dans ce modèle simplifié
  };
}

export async function generateCareerContracts(
  careerId: string,
  leagueId: string,
  players: Player[]
): Promise<void> {
  const rows = players.map((player) => {
    const terms = generateContractTerms(player.overallRating, leagueId);
    return {
      careerId,
      playerId: player.id,
      teamId: player.teamId, // point de départ = affectation du catalogue
      ...terms,
      // Un joueur déjà renommé au départ (voir initialRenown) n'accepte pas
      // moins que son exigence salariale, même dans le roster de départ.
      salary: Math.max(
        terms.salary,
        minAcceptableSalary(player.renown, player.overallRating, leagueId)
      ),
    };
  });

  await prisma.contract.createMany({ data: rows });
}

import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { SALARY_RANGES, salaryForRating } from "./salary-rules";
import { minAcceptableSalary } from "./player-demands";
import { ALT_CONTRACT_TYPE, ALT_CONTRACT_SALARY } from "./contract-type-rules";

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

// `developmentPlayerIds` : joueuses qui démarrent sous contrat alternatif
// (développement WNBA / two-way NBA, voir contract-type-rules.ts) plutôt que
// standard — voir INITIAL_DEVELOPMENT_CONTRACT_IDS dans players-wnba.ts pour
// la liste WNBA et actions/career.ts pour comment le reliquat au-dessus de
// MAX_ROSTER_SIZE y est ajouté. Salaire fixe symbolique, jamais le
// realSalary/procédural (ce ne serait plus cohérent avec un contrat
// alternatif, qui n'entre ni dans le plafond salarial ni le roster
// standard).
export async function generateCareerContracts(
  careerId: string,
  leagueId: string,
  players: Player[],
  developmentPlayerIds: Set<string> = new Set()
): Promise<void> {
  const altContractType = ALT_CONTRACT_TYPE[leagueId];
  const altSalary = ALT_CONTRACT_SALARY[leagueId] ?? 0;

  const rows = players.map((player) => {
    if (altContractType && developmentPlayerIds.has(player.id)) {
      return {
        careerId,
        playerId: player.id,
        teamId: player.teamId,
        contractType: altContractType,
        salary: altSalary,
        yearsRemaining: 1,
        guaranteed: false,
      };
    }

    // Salaire/durée réels connus (catalogue, source publique) : priment sur
    // la génération procédurale — plus fidèle qu'une estimation basée sur le
    // seul overall, et évite qu'un floor synthétique (minAcceptableSalary)
    // vienne contredire une donnée déjà vérifiée.
    if (player.realSalary != null && player.realYearsRemaining != null) {
      return {
        careerId,
        playerId: player.id,
        teamId: player.teamId,
        contractType: "standard",
        salary: player.realSalary,
        yearsRemaining: player.realYearsRemaining,
        guaranteed: true,
      };
    }

    const terms = generateContractTerms(player.overallRating, leagueId);
    return {
      careerId,
      playerId: player.id,
      teamId: player.teamId, // point de départ = affectation du catalogue
      contractType: "standard",
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

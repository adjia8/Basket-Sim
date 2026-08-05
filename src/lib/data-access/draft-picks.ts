import "server-only";
import type { DraftPick } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rookieScaleContract } from "@/lib/careers/rookie-scale";
import { MAX_ROSTER_SIZE } from "@/lib/careers/roster-rules";
import { getPayrollForTeam } from "./contracts";

// Le pick "sur l'horloge" a toujours un pickNumber résolu (jamais un pick
// futur pas encore joué) : ce type le reflète pour éviter d'avoir à
// re-vérifier la nullabilité partout où getCurrentDraftPick est utilisé.
export type ResolvedDraftPick = DraftPick & { pickNumber: number };

// Le pick "sur l'horloge" : le plus petit pickNumber encore "pending". Le
// salaire d'un pick est fixé par sa position (pas par le prospect choisi),
// donc on peut savoir si l'équipe concernée peut légalement drafter à ce pick
// sans avoir à boucler sur les prospects restants. Si elle ne peut pas
// (effectif complet ou plafond dépassé), le pick est marqué "skipped" et on
// passe au suivant. Les écritures de skip sont gardées par
// `status: "pending"` dans le WHERE, donc cette fonction est sûre à appeler
// depuis le rendu d'un Server Component : un rechargement de page fait
// naturellement avancer l'horloge si une équipe est bloquée.
export async function getCurrentDraftPick(
  careerId: string,
  season: string,
  salaryCap: number,
  picksPerRound: number,
  leagueId: string
): Promise<ResolvedDraftPick | null> {
  for (;;) {
    const pick = await prisma.draftPick.findFirst({
      where: { careerId, season, status: "pending", pickNumber: { not: null } },
      orderBy: { pickNumber: "asc" },
    });
    if (!pick || pick.pickNumber === null) return null;

    const [rosterSize, payroll] = await Promise.all([
      prisma.contract.count({ where: { careerId, teamId: pick.teamId } }),
      getPayrollForTeam(careerId, pick.teamId),
    ]);
    const { salary } = rookieScaleContract(pick.pickNumber, picksPerRound, leagueId);
    const canDraft = rosterSize < MAX_ROSTER_SIZE && payroll + salary <= salaryCap;
    if (canDraft) return pick as ResolvedDraftPick;

    const { count } = await prisma.draftPick.updateMany({
      where: { id: pick.id, status: "pending" },
      data: { status: "skipped" },
    });
    if (count === 0) continue; // déjà traité entre-temps par une requête concurrente
  }
}

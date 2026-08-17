"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { toDomainGame } from "@/lib/data-access/mappers";
import { simulateAndResolveGame } from "@/lib/data-access/simulate";
import { getTranslator } from "@/lib/i18n/translate";

// Aucun match IA-vs-IA ne se simule tout seul dans ce jeu — seulement les
// matchs qu'un manager humain déclenche explicitement (voir
// /api/simulate-game). Sans ça, le reste de la ligue reste figé à 0-0 pour
// toujours (aucun bilan, aucune stat), et ça bloque même advanceSeason (voir
// actions/season.ts), qui exige que TOUS les matchs de la saison soient
// "final" avant de pouvoir enchaîner. Ce lot rejoue les matchs opposant deux
// équipes IA (aucune Membership des deux côtés) — jamais un match impliquant
// un manager humain, même IA vs humain, pour ne jamais court-circuiter un
// match que quelqu'un doit décider de jouer lui-même.
//
// Traité par petits lots séquentiels plutôt qu'en un seul appel géant : une
// saison complète peut compter plusieurs centaines de matchs IA, et chacun
// enchaîne une bonne quinzaine de requêtes (fatigue, blessures, chimie,
// renommée...) — en pratique 30-50s par match. Un lot de 15 dépassait de
// loin le maxDuration de la page (voir schedule/page.tsx) : la fonction
// serverless se faisait tuer par la plateforme avant de renvoyer quoi que
// ce soit, ce qui laissait l'UI figée indéfiniment. Un match à la fois tient
// large sous ce plafond et fait progresser l'affichage à chaque match plutôt
// qu'une fois tous les dix. Le client relance l'action tant que
// `remaining > 0`, avec un indicateur de progression entre chaque lot.
const BATCH_SIZE = 1;

export interface SimulateAllAiGamesResult {
  simulated: number;
  remaining: number;
  error?: string;
}

export async function simulateAllAiGames(): Promise<SimulateAllAiGamesResult> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();

  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) {
    return { simulated: 0, remaining: 0, error: "No career" };
  }

  const careerId = membership.careerId;

  const humanMemberships = await prisma.membership.findMany({
    where: { careerId },
    select: { teamId: true },
  });
  const humanTeamIds = humanMemberships.map((m) => m.teamId);

  const pendingRows = await prisma.game.findMany({
    where: {
      careerId,
      status: { not: "final" },
      homeTeamId: { notIn: humanTeamIds },
      awayTeamId: { notIn: humanTeamIds },
    },
    orderBy: { gameDate: "asc" },
  });

  const totalPending = pendingRows.length;
  const batch = pendingRows.slice(0, BATCH_SIZE);

  // Séquentiel, jamais Promise.all : le repos/la fatigue/la chimie de
  // chaque match dépendent de l'état laissé par les matchs précédents de la
  // même équipe (voir simulateAndResolveGame) — les paralléliser produirait
  // des jours de repos et des classements incohérents.
  let simulatedCount = 0;
  for (const row of batch) {
    const game = toDomainGame(row);
    try {
      await simulateAndResolveGame(careerId, game, locale);
      simulatedCount++;
    } catch {
      // Un seul match à données incohérentes (équipe introuvable, ne
      // devrait jamais arriver) ne doit pas bloquer tout le lot — il
      // restera "scheduled" et sera retenté au prochain lot.
      continue;
    }
  }

  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/", "layout");

  return { simulated: simulatedCount, remaining: totalPending - simulatedCount };
}

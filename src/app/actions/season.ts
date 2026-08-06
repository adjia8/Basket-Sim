"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { generateCareerSchedule } from "@/lib/careers/generate-schedule";
import { generateProspectClass } from "@/lib/careers/generate-prospects";
import {
  createUnresolvedPicksForSeason,
  FUTURE_PICK_WINDOW,
  futureSeasonsAfter,
} from "@/lib/careers/generate-draft-picks";
import { nextSeasonLabel } from "@/lib/careers/season-format";
import { ageOneSeason, RETIREMENT_AGE } from "@/lib/careers/aging-rules";
import { toDomainLeague } from "@/lib/data-access/mappers";

export async function advanceSeason(): Promise<void> {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: { include: { league: { include: { conferences: true } } } } },
  });
  if (!membership) return;
  const career = membership.career;

  // Vérification côté serveur : ne fait pas confiance au bandeau affiché côté UI.
  const currentSeasonGames = await getScheduleForCareer(career.id, career.season);
  const seasonComplete =
    currentSeasonGames.length > 0 &&
    currentSeasonGames.every((g) => g.status === "final");
  if (!seasonComplete) return;

  // La saison régulière terminée ne suffit pas : il faut aussi qu'un champion
  // de playoffs soit désigné (avance/crée le bracket au passage si besoin).
  const playoffs = await getOrAdvancePlayoffs(career.id, career.season, career.leagueId);
  if (!playoffs?.champion) return;

  // Ordre du draft basé sur le classement de la saison qui vient de se
  // terminer (la pire équipe choisit en premier) — calculé maintenant, avant
  // que `career.season` soit écrasé par la nouvelle saison plus bas.
  const finishedStandings = await getStandings(career.id, career.leagueId, career.season);
  const draftOrder = [...finishedStandings].sort((a, b) =>
    a.wins !== b.wins
      ? a.wins - b.wins
      : a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst)
  );
  const draftOrderTeamIds = draftOrder.map((row) => row.teamId);

  // 1. Contrats : décrément, résiliation à 0 (le joueur devient agent libre).
  await prisma.contract.updateMany({
    where: { careerId: career.id },
    data: { yearsRemaining: { decrement: 1 } },
  });
  await prisma.contract.deleteMany({
    where: { careerId: career.id, yearsRemaining: { lte: 0 } },
  });

  // 1bis. Argent mort : même décompte que les contrats, jusqu'à expiration.
  await prisma.deadCap.updateMany({
    where: { careerId: career.id },
    data: { yearsRemaining: { decrement: 1 } },
  });
  await prisma.deadCap.deleteMany({
    where: { careerId: career.id, yearsRemaining: { lte: 0 } },
  });

  // 2. Vieillissement + retraites.
  const states = await prisma.playerState.findMany({
    where: { careerId: career.id, retired: false },
  });
  for (const state of states) {
    const aged = ageOneSeason(state);
    const retiring = aged.age >= RETIREMENT_AGE;
    await prisma.playerState.update({
      where: { id: state.id },
      data: { ...aged, retired: retiring },
    });
    if (retiring) {
      await prisma.contract.deleteMany({
        where: { careerId: career.id, playerId: state.playerId },
      });
    }
  }

  // 3. Nouvelle saison.
  const newSeason = nextSeasonLabel(career.season);
  await prisma.career.update({
    where: { id: career.id },
    data: { season: newSeason },
  });

  // 4. Nouvelle classe de prospects (l'ancienne, non draftée, disparaît).
  // 2 tours × nb d'équipes de la ligue : toujours assez de prospects pour
  // que chaque pick ait un candidat disponible.
  await prisma.prospect.deleteMany({ where: { careerId: career.id } });
  await generateProspectClass(career.id, career.leagueId, draftOrderTeamIds.length * 2);

  // 4bis. Résout les picks de la nouvelle saison (déjà créés à l'avance, non
  // résolus, à la création de la carrière ou lors d'un rollover précédent —
  // filet de sécurité au cas où). Le pickNumber suit l'ordre inverse du
  // classement de l'équipe d'ORIGINE (originalTeamId), pas de son
  // propriétaire actuel : un pick déjà échangé garde son nouveau
  // propriétaire, seul le classement de qui l'a "généré" compte pour sa
  // position.
  await createUnresolvedPicksForSeason(career.id, newSeason, draftOrderTeamIds);
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < draftOrderTeamIds.length; i++) {
      const pickNumber = (round - 1) * draftOrderTeamIds.length + i + 1;
      await prisma.draftPick.updateMany({
        where: {
          careerId: career.id,
          season: newSeason,
          round,
          originalTeamId: draftOrderTeamIds[i],
          pickNumber: null,
        },
        data: { pickNumber },
      });
    }
  }

  // Ouvre la fenêtre de picks futurs à l'autre bout : la saison qui vient de
  // se résoudre libère un cran, donc une nouvelle saison future apparaît.
  const newFarSeason = futureSeasonsAfter(newSeason, FUTURE_PICK_WINDOW).at(-1)!;
  await createUnresolvedPicksForSeason(career.id, newFarSeason, draftOrderTeamIds);

  // 5. Nouveau calendrier, tout "scheduled" (rien à pré-simuler).
  await generateCareerSchedule(career.id, toDomainLeague(career.league), {
    seasonLabel: newSeason,
    presimulatePast: false,
  });

  revalidatePath("/", "layout");
}

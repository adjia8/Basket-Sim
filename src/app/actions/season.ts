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
import { isHallOfFameWorthy } from "@/lib/careers/hall-of-fame-rules";
import { toDomainLeague } from "@/lib/data-access/mappers";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { applySeasonFinancials, getOrCreateTeamState } from "@/lib/data-access/team-state";
import { winPctForStandings } from "@/lib/careers/player-demands";

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

  // Niveaux de personnel de training par équipe, capturés maintenant (avant
  // la dégradation annuelle plus bas) — le bonus de progression des jeunes
  // joueurs doit refléter l'encadrement pendant la saison qui vient de se
  // jouer. Correspondance joueur -> équipe via les contrats encore actifs à
  // cet instant (avant le décrément de l'étape 1).
  const teams = await getTeamsByLeague(career.leagueId);
  const teamStates = await Promise.all(
    teams.map((t) => getOrCreateTeamState(career.id, t.id, career.leagueId))
  );
  const trainingStaffByTeamId = new Map(teamStates.map((s) => [s.teamId, s.trainingStaffLevel]));
  const activeContracts = await prisma.contract.findMany({ where: { careerId: career.id } });
  const teamIdByPlayerId = new Map(activeContracts.map((c) => [c.playerId, c.teamId]));

  // Calculé maintenant (pure string, avant l'écriture en base à l'étape 3) :
  // sert de marqueur "cette intersaison" pour retiredSeason et pour la
  // nouvelle classe de prospects réels éventuelle.
  const newSeason = nextSeasonLabel(career.season);

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
    const teamId = teamIdByPlayerId.get(state.playerId);
    const trainingStaffLevel = teamId ? (trainingStaffByTeamId.get(teamId) ?? 50) : 50;
    const aged = ageOneSeason(state, trainingStaffLevel);
    const retiring = aged.age >= RETIREMENT_AGE;
    // Pics de carrière : basés sur les meilleures valeurs jamais atteintes
    // (avant le déclin de fin de carrière), déterminent l'éligibilité au
    // Hall of Fame à la retraite.
    const peakOverallRating = Math.max(state.peakOverallRating, aged.overallRating);
    const peakRenown = Math.max(state.peakRenown, state.renown);
    await prisma.playerState.update({
      where: { id: state.id },
      data: {
        ...aged,
        retired: retiring,
        peakOverallRating,
        peakRenown,
        ...(retiring
          ? {
              retiredSeason: newSeason,
              hallOfFame: isHallOfFameWorthy(peakOverallRating, peakRenown),
            }
          : {}),
      },
    });
    if (retiring) {
      await prisma.contract.deleteMany({
        where: { careerId: career.id, playerId: state.playerId },
      });
    }
  }

  // 2bis. Finances de franchise : revenu de la saison qui vient de se
  // terminer (bilan + attractivité du marché) pour chaque équipe de la
  // ligue, puis dégradation annuelle des infrastructures/personnel non
  // réinvestis.
  for (const team of teams) {
    const row = finishedStandings.find((s) => s.teamId === team.id);
    const winPct = winPctForStandings(row?.wins ?? 0, row?.losses ?? 0);
    await applySeasonFinancials(career.id, team.id, career.leagueId, winPct, team.marketAppeal);
  }

  // 3. Nouvelle saison (label déjà calculé plus haut, dans newSeason).
  await prisma.career.update({
    where: { id: career.id },
    data: { season: newSeason },
  });

  // 4. Nouvelle classe de prospects (l'ancienne, non draftée, disparaît).
  // 2 tours × nb d'équipes de la ligue : toujours assez de prospects pour
  // que chaque pick ait un candidat disponible.
  await prisma.prospect.deleteMany({ where: { careerId: career.id } });
  await generateProspectClass(career.id, career.leagueId, draftOrderTeamIds.length * 2, newSeason);

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

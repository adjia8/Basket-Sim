"use server";

import { activeMembershipWhere } from "@/lib/auth/active-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getScheduleForCareer } from "@/lib/data-access/schedule";
import { getStandings } from "@/lib/data-access/standings";
import { getOrAdvancePlayoffs } from "@/lib/data-access/playoffs";
import { generateCareerPreseasonSchedule, generateCareerSchedule } from "@/lib/careers/generate-schedule";
import {
  createUnresolvedPicksForSeason,
  FUTURE_PICK_WINDOW,
  futureSeasonsAfter,
} from "@/lib/careers/generate-draft-picks";
import { nextSeasonLabel } from "@/lib/careers/season-format";
import { preseasonSeasonLabel, seasonCalendar } from "@/lib/careers/schedule-rules";
import { ageOneSeason, RETIREMENT_AGE, retirementPlanned } from "@/lib/careers/aging-rules";
import { isHallOfFameWorthy } from "@/lib/careers/hall-of-fame-rules";
import { toDomainLeague } from "@/lib/data-access/mappers";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { applySeasonFinancials, getOrCreateTeamState } from "@/lib/data-access/team-state";
import { winPctForStandings } from "@/lib/careers/player-demands";
import { getPlayoffResultTier } from "@/lib/data-access/playoffs";
import { evaluateGmSeason, type ExpectationTier } from "@/lib/careers/gm-rules";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { evaluatePendingPromises } from "@/lib/data-access/trade-requests";
import { createInboxMessage } from "@/lib/data-access/inbox";
import { poachOfferMessageText } from "@/lib/careers/inbox-rules";
import { getTranslator, translatorFor } from "@/lib/i18n/translate";
import { maybeAiFacilityProjects } from "@/lib/data-access/ai-facilities";
import { europeOffseason } from "@/lib/data-access/europe";
import { ensureDraftClass, maybeChampionCeremony } from "@/lib/data-access/offseason";
import { ensureGmContract, pointsOf, seasonStyle, standingParts } from "@/lib/data-access/gm-career";
import {
  attributeEvolution,
  clubStanding,
  extensionOffer,
  gmSalary,
  interestedTeams,
  parseLifestyle,
  poachChance,
  prestigeOf,
  reputationAfterSeason,
  severancePay,
} from "@/lib/careers/gm-career-rules";
import { formatSalary, playerHref, teamFullName } from "@/lib/utils";
import { offseasonRecovery } from "@/lib/careers/injury-rules";
import { ensureCareerStaff, getStaffProfiles, processStaffOffseason } from "@/lib/data-access/staff";
import { moraleAfterSummer } from "@/lib/careers/morale-rules";
import { resolveContractOptions } from "@/lib/data-access/negotiations";
import { nbaScheduleExtras } from "@/lib/careers/nba-cup-rules";
import { parseSeasonReview, planEffects, shiftTier } from "@/lib/careers/offseason-rules";

// Patch PlayerState de l'intersaison côté santé : énergie pleine, blessures
// guéries d'environ 50 matchs, statut de blessure effacé si rétabli.
function healthAfterSummer(state: { injured: boolean; injuryGamesRemaining: number; conditioning: number }) {
  const r = offseasonRecovery(state);
  return {
    fatigue: r.fatigue,
    injured: r.injured,
    injuryGamesRemaining: r.injuryGamesRemaining,
    conditioning: r.conditioning,
    ...(r.injured ? {} : { injurySeverity: null, injuryType: null, playingThroughInjury: false }),
  };
}


export async function advanceSeason(): Promise<void> {
  const { userId } = await verifySession();
  const { locale } = await getTranslator();
  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
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
  // MVP des Finales et annonce du champion, si personne n'est passé par « Continuer ».
  await maybeChampionCeremony(career.id, career.leagueId, career.season, locale);

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
  // Chapeaux du tirage de la NBA Cup suivante (meilleurs bilans d'abord).
  const conferenceOf = new Map(
    (await prisma.team.findMany({ where: { leagueId: career.leagueId }, include: { conference: true } })).map((t) => [
      t.id,
      /east/i.test(t.conference.name) ? "east" : "west",
    ])
  );
  const bestFirst = [...draftOrderTeamIds].reverse();
  const rankedByConference = {
    east: bestFirst.filter((id) => conferenceOf.get(id) === "east"),
    west: bestFirst.filter((id) => conferenceOf.get(id) === "west"),
  };

  // Niveaux de personnel de training par équipe, capturés maintenant (avant
  // la dégradation annuelle plus bas) — le bonus de progression des jeunes
  // joueurs doit refléter l'encadrement pendant la saison qui vient de se
  // jouer. Correspondance joueur -> équipe via les contrats encore actifs à
  // cet instant (avant le décrément de l'étape 1).
  const teams = await getTeamsByLeague(career.leagueId);
  const teamStates = await Promise.all(
    teams.map((t) => getOrCreateTeamState(career.id, t.id, career.leagueId))
  );
  // Progression annuelle des joueurs : selon le niveau « développement » du
  // vrai staff de leur équipe (voir staff-rules.ts).
  await ensureCareerStaff(career.id, career.leagueId, career.season);
  const staffProfilesByTeam = await getStaffProfiles(career.id, teams.map((t) => t.id), career.leagueId);
  const trainingStaffByTeamId = new Map(teams.map((t) => [t.id, staffProfilesByTeam.get(t.id)?.development ?? 50]));
  const activeContracts = await prisma.contract.findMany({ where: { careerId: career.id } });
  const teamIdByPlayerId = new Map(activeContracts.map((c) => [c.playerId, c.teamId]));

  // Calculé maintenant (pure string, avant l'écriture en base à l'étape 3) :
  // sert de marqueur "cette intersaison" pour retiredSeason et pour la
  // nouvelle classe de prospects réels éventuelle.
  const newSeason = nextSeasonLabel(career.season);

  // 0. Options sur la dernière année (joueur / équipe), avant le décrément.
  const optionEvents = await resolveContractOptions(career.id, career.leagueId);
  if (optionEvents.length > 0) {
    const { t: tOpt, locale: optLocale } = await getTranslator();
    const humanTeamIds = new Set(
      (await prisma.membership.findMany({ where: { careerId: career.id }, select: { teamId: true } })).map((m) => m.teamId)
    );
    for (const ev of optionEvents) {
      if (!humanTeamIds.has(ev.teamId)) continue;
      const vars = { player: ev.playerName, amount: formatSalary(ev.salary, optLocale) };
      await createInboxMessage(
        career.id,
        ev.teamId,
        career.season,
        "contract",
        tOpt(`nego.optionInbox.${ev.kind}.title`, vars),
        tOpt(`nego.optionInbox.${ev.kind}.body`, vars),
        playerHref(ev.playerId, ev.kind === "playerIn" ? ev.teamId : null),
        { playerId: ev.playerId }
      );
    }
  }

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
    // Même décision que celle annoncée à la cérémonie de fin de saison.
    const retiring = aged.age >= RETIREMENT_AGE || retirementPlanned(state, `${career.id}:${state.playerId}:${career.season}:retire`);
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
        // Coupure estivale : l'usure de la saison s'efface, repos programmé
        // et progression en cours repartent de zéro, les blessures guérissent
        // d'environ 50 matchs (voir offseasonRecovery).
        ...healthAfterSummer(state),
        morale: moraleAfterSummer(state.morale),
        wear: 0,
        restNextGame: false,
        developmentProgress: 0,
        ...(retiring
          ? {
              retiredSeason: newSeason,
              hallOfFame: isHallOfFameWorthy(peakOverallRating, peakRenown),
              // Dernière équipe active au moment de la retraite — capturée ici
              // car le Contract est supprimé juste après (voir plus bas) :
              // c'est le seul moment où cette info est encore disponible sans
              // requête supplémentaire (voir franchise-history.ts pour son
              // usage, la page Franchise affichant les légendes du club).
              hallOfFameTeamId: teamId ?? null,
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

  // Compteur de critiques de l'arbitrage (amendes) : remis à zéro chaque saison.
  await prisma.teamState.updateMany({ where: { careerId: career.id }, data: { refereeCriticisms: 0 } });

  // 2bis. Finances de franchise : revenu de la saison qui vient de se
  // terminer (bilan + attractivité du marché) pour chaque équipe de la
  // ligue, puis dégradation annuelle des infrastructures/personnel non
  // réinvestis.
  // (Recettes et dépenses courantes déjà encaissées match par match : ici,
  // taxe de luxe, part des propriétaires et usure des installations.)
  for (const team of teams) {
    await applySeasonFinancials(career.id, team.id, career.leagueId, career.season);
  }
  // Intersaison : les équipes IA en profitent pour lancer des chantiers
  // (comptés sur la saison qui démarre — voir ai-facilities.ts).
  const lastGame = await prisma.game.findFirst({ where: { careerId: career.id, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } });
  await maybeAiFacilityProjects(career.id, career.leagueId, newSeason, lastGame?.gameDate ?? new Date(), locale, 0.6);

  // 2ter. Évaluation des GM humains : compare l'objectif de pré-saison au
  // résultat réel des playoffs (+ pénalité si finances négatives en fin de
  // saison), journalise le bilan, et déclenche avertissement/licenciement/
  // offre de dépeçage. Doit tourner APRÈS les finances de l'étape 2bis (pour
  // évaluer les finances à jour) et AVANT l'écrasement de career.season plus
  // bas (finishedStandings/playoffs portent encore sur la saison qui se termine).
  const gmMemberships = await prisma.membership.findMany({
    where: { careerId: career.id },
    include: { gmProfile: true },
  });
  for (const member of gmMemberships) {
    const gmProfile = member.gmProfile;
    if (!gmProfile) continue;

    const standingsRow = finishedStandings.find((s) => s.teamId === member.teamId);
    const [resultTier, teamState] = await Promise.all([
      getPlayoffResultTier(career.id, career.season, member.teamId),
      getOrCreateTeamState(career.id, member.teamId, career.leagueId),
    ]);
    // Verdict de la réunion de fin de saison (page /offseason) s'il a eu
    // lieu : figé à ce moment-là — sinon, calculé maintenant.
    const review = parseSeasonReview(gmProfile.seasonReviewJson);
    const meeting = review?.season === career.season ? review : null;
    const outcome =
      meeting?.outcome ??
      evaluateGmSeason(
        gmProfile.currentExpectationTier as ExpectationTier,
        resultTier,
        teamState.finances < 0,
        gmProfile.warningsAtCurrentTeam,
        gmProfile.frontOfficeApproval
      ).outcome;

    await prisma.gmSeasonRecord.create({
      data: {
        gmProfileId: gmProfile.id,
        teamId: member.teamId,
        season: career.season,
        wins: standingsRow?.wins ?? 0,
        losses: standingsRow?.losses ?? 0,
        expectationTier: gmProfile.currentExpectationTier,
        resultTier,
        outcome,
      },
    });

    // Carrière du GM (voir gm-career-rules.ts) : compétences selon les
    // résultats et le style de jeu, réputation, contrat.
    const contract = await ensureGmContract(gmProfile, career.leagueId, member.teamId);
    const [style, parts] = await Promise.all([
      seasonStyle(career.id, member.teamId, finishedStandings, outcome),
      standingParts(career.id, member.teamId, gmProfile),
    ]);
    const deltas = attributeEvolution(pointsOf(gmProfile), style);
    const standing = clubStanding(parts);
    const reputation = reputationAfterSeason({
      reputation: gmProfile.reputation,
      standing,
      outcome,
      champion: resultTier === "champion",
      prestige: prestigeOf(parseLifestyle(gmProfile.lifestyleJson)),
    });
    const tf = translatorFor(locale);
    const money = (v: number) => formatSalary(v, locale);
    const pointsData = {
      offensePoints: gmProfile.offensePoints + deltas.offense,
      defensePoints: gmProfile.defensePoints + deltas.defense,
      physicalPoints: gmProfile.physicalPoints + deltas.physical,
      tacticalPoints: gmProfile.tacticalPoints + deltas.tactical,
      chemistryPoints: gmProfile.chemistryPoints + deltas.chemistry,
    };
    const yearsLeft = contract.years - 1;
    const changes = { season: career.season, deltas, reputationBefore: gmProfile.reputation, reputation, standing, parts };

    if (outcome === "fired") {
      // Indemnités : la moitié du salaire des saisons restantes.
      const severance = severancePay(contract.salary, yearsLeft);
      await prisma.gmProfile.update({
        where: { id: gmProfile.id },
        data: {
          ...pointsData,
          reputation,
          pendingReassignment: true,
          personalCash: gmProfile.personalCash + severance,
          contractSalary: 0,
          contractYears: 0,
          pendingExtensionJson: null,
          lastSeasonChangesJson: JSON.stringify({ ...changes, severance }),
        },
      });
      continue; // le GM viré choisira sa nouvelle franchise via /onboarding/reassign
    }

    // Fin de contrat : prolongation proposée si le travail est bon ; sinon,
    // après un avertissement, la direction ne le renouvelle pas.
    const currentTeam = teams.find((t) => t.id === member.teamId);
    const extension = extensionOffer({
      salary: contract.salary,
      yearsLeft,
      outcome,
      marketSalary: gmSalary(career.leagueId, currentTeam?.marketAppeal ?? 50, reputation),
    });
    if (yearsLeft <= 0 && !extension && outcome === "warning") {
      await prisma.gmProfile.update({
        where: { id: gmProfile.id },
        data: {
          ...pointsData,
          reputation,
          pendingReassignment: true,
          contractSalary: 0,
          contractYears: 0,
          lastSeasonChangesJson: JSON.stringify({ ...changes, notRenewed: true }),
        },
      });
      continue;
    }
    if (extension) {
      await createInboxMessage(
        career.id,
        member.teamId,
        newSeason,
        "board",
        tf("gmCareer.inbox.extensionTitle"),
        tf("gmCareer.inbox.extensionBody", { salary: money(extension.salary), years: extension.years }),
        "/gm",
        { priority: "urgent" }
      );
    }

    const nextWarnings = outcome === "warning" ? gmProfile.warningsAtCurrentTeam + 1 : 0;
    // Offres d'autres clubs : plus fréquentes et plus prestigieuses avec
    // la réputation.
    let pendingOfferTeamId: string | null = null;
    let pendingOfferJson: string | null = null;
    if (teamState.finances >= 0 && Math.random() < poachChance(outcome, reputation)) {
      const takenTeamIds = new Set(gmMemberships.map((m) => m.teamId));
      const candidates = interestedTeams(
        teams.filter((t) => !takenTeamIds.has(t.id)),
        reputation,
        0
      ).filter((t) => t.marketAppeal > (currentTeam?.marketAppeal ?? 0) - 10);
      if (candidates.length > 0) {
        const chosenTeam = candidates[Math.floor(Math.random() * candidates.length)];
        pendingOfferTeamId = chosenTeam.id;
        const terms = { salary: Math.round((gmSalary(career.leagueId, chosenTeam.marketAppeal, reputation) * 1.1) / 50_000) * 50_000, years: 3 };
        pendingOfferJson = JSON.stringify(terms);
        const { title, body } = poachOfferMessageText(locale, teamFullName(chosenTeam));
        await createInboxMessage(
          career.id,
          member.teamId,
          newSeason,
          "poach_offer",
          title,
          `${body}\n\n${tf("gmCareer.inbox.offerTerms", { salary: money(terms.salary), years: terms.years })}`,
          "/gm"
        );
      }
    }

    // Objectif de la saison à venir : rang de force du roster tel qu'il
    // sera (contrats/vieillissement déjà appliqués aux étapes 1-2 ci-dessus)
    // parmi toutes les équipes de la ligue.
    const nextExpectations = await getCareerExpectations(career.id, career.leagueId);
    await prisma.gmProfile.update({
      where: { id: gmProfile.id },
      data: {
        ...pointsData,
        reputation,
        // Contrat « à l'année » au-delà du terme, tant qu'aucune prolongation n'est signée.
        contractYears: Math.max(1, yearsLeft),
        pendingExtensionJson: extension ? JSON.stringify(extension) : null,
        lastSeasonChangesJson: JSON.stringify({ ...changes, extension }),
        warningsAtCurrentTeam: nextWarnings,
        pendingOfferTeamId,
        pendingOfferJson,
        // Cap annoncé à la direction : objectif relevé ou abaissé d'un cran.
        currentExpectationTier: shiftTier(
          (nextExpectations.get(member.teamId) ?? "playoffs") as ExpectationTier,
          meeting?.plan ? planEffects(meeting.plan, outcome).tierShift : 0
        ),
      },
    });
  }

  // 2quater. Résolution des promesses en attente pour la saison qui se
  // termine — DOIT tourner avec finishedStandings/teamStates capturés plus
  // haut (teamStates = infrastructures AVANT la dégradation annuelle de
  // l'étape 2bis) et AVANT l'écrasement de career.season juste en dessous.
  await evaluatePendingPromises(career.id, career.season, finishedStandings, teamStates);
  // Europe : une saison de plus dans les clubs européens, droits non signés éteints.
  await europeOffseason(career.id);

  // 3. Nouvelle saison (label déjà calculé plus haut, dans newSeason).
  await prisma.career.update({
    where: { id: career.id },
    data: { season: newSeason },
  });

  // 3bis. Staff : vieillissement, retraites, fins de contrat, marché,
  // budgets de la nouvelle saison, l'IA comble ses postes vacants.
  const winPctByTeam = new Map(
    finishedStandings.map((row) => [row.teamId, winPctForStandings(row.wins, row.losses)])
  );
  await processStaffOffseason(career.id, career.leagueId, newSeason, winPctByTeam, locale);

  // 4. Nouvelle classe de prospects (l'ancienne, non draftée, disparaît).
  // 2 tours × nb d'équipes de la ligue : toujours assez de prospects pour
  // que chaque pick ait un candidat disponible.
  // (Déjà révélée à la cérémonie de fin de saison : on la garde.)
  await ensureDraftClass(career.id, career.leagueId, newSeason, draftOrderTeamIds.length * 2);

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

  // 5. Nouvelle pré-saison puis nouvelle saison régulière, toutes deux
  // "scheduled" — même logique qu'à la création de la Career (voir
  // actions/career.ts) : chaque rentrée de saison repasse par une pré-saison.
  const calendar = seasonCalendar(career.leagueId, newSeason, new Date());
  await generateCareerPreseasonSchedule(career.id, toDomainLeague(career.league), {
    seasonLabel: preseasonSeasonLabel(newSeason),
    startDate: calendar.preseasonStart,
  });
  await generateCareerSchedule(career.id, toDomainLeague(career.league), {
    seasonLabel: newSeason,
    startDate: calendar.regularSeasonStart,
    seasonDays: calendar.regularSeasonDays,
    ...nbaScheduleExtras(career.leagueId, newSeason, rankedByConference),
  });

  revalidatePath("/", "layout");
  // Depuis la page de fin de saison : retour au tableau de bord de la nouvelle saison.
  redirect("/");
}

import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlayerStatePatches } from "./player-state-patches";
import type { BoxScoreEntry, Player } from "@/lib/types";
import { fatigueAtTipOff, fatigueGainForGame } from "@/lib/careers/fatigue-rules";
import { staffEffects, staffProfile } from "@/lib/careers/staff-rules";
import { clampWear, wearGainForGame, wearRecovery } from "@/lib/careers/wear-rules";
import type { TrainingIntensity } from "@/lib/careers/training-rules";

// Jours de repos réels avant `currentGameDate`, fiables depuis la correction
// du générateur de calendrier (Phase A — plus de collisions same-day). Pas de
// match antérieur cette saison (tout premier match) : repos par défaut
// raisonnable de 3 jours (début de saison, pas de fatigue accumulée).
export async function getRestDays(
  careerId: string,
  teamId: string,
  season: string,
  currentGameDate: Date
): Promise<number> {
  const previous = await prisma.game.findFirst({
    where: {
      careerId,
      // Tous les matchs de la saison (régulière, NBA Cup, playoffs) : seul
      // le dernier match joué compte pour le repos.
      season: { startsWith: season.slice(0, 9) },
      status: "final",
      gameDate: { lt: currentGameDate },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { gameDate: "desc" },
  });
  if (!previous) return 3;
  const diffMs = currentGameDate.getTime() - previous.gameDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Appelé juste après la résolution d'un match : récupère chaque joueur du
// roster complet selon les jours de repos réels avant ce match (moins vite
// s'il est usé), puis ajoute le gain de fatigue pour ceux qui ont
// effectivement joué (présents au box score — un banc qui ne rentre jamais
// en rotation ne se fatigue pas). Met aussi à jour l'usure : minutes
// jouées, back-to-back et intensité d'entraînement l'augmentent, le repos
// (jours sans match, match passé sur le banc ou au repos) la résorbe.
export async function advanceRosterFatigue(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  restDays: number,
  facilitiesLevel = 50,
  trainingFatigueDelta = 0,
  intensity: TrainingIntensity | null = null,
  // Préparateurs physiques (voir staffEffects) : usure accumulée et
  // récupération d'énergie.
  // gainFactor : charge tactique (rythme rapide, pressing — voir tacticalLoad).
  fitness: { wearFactor: number; fatigueRecoveryFactor: number; gainFactor?: number } = {
    wearFactor: 1,
    fatigueRecoveryFactor: 1,
  }
): Promise<void> {
  const playedIds = new Set(boxScore.map((e) => e.playerId));
  const minutesById = new Map(boxScore.map((e) => [e.playerId, e.minutesPlayed]));

  for (const player of roster) {
    const wear = player.wear ?? 0;
    const minutes = minutesById.get(player.id) ?? 0;
    const newWear = clampWear(
      wear -
        wearRecovery(restDays, minutes === 0, facilitiesLevel, wear) +
        wearGainForGame(minutes, restDays, player.ratings.stamina, intensity) * fitness.wearFactor * (fitness.gainFactor ?? 1)
    );
    let newFatigue = fatigueAtTipOff(
      player.fatigue,
      restDays,
      player.ratings.stamina,
      facilitiesLevel,
      wear,
      fitness.fatigueRecoveryFactor
    );
    if (playedIds.has(player.id)) {
      newFatigue += fatigueGainForGame(player.ratings.stamina) * (fitness.gainFactor ?? 1);
    }
    // L'entraînement a lieu entre les matchs, pour tout l'effectif (pas
    // seulement ceux qui ont joué ce match précis).
    newFatigue += trainingFatigueDelta;
    newFatigue = Math.max(0, Math.min(99, newFatigue));

    patches.set(player.id, { fatigue: newFatigue, wear: newWear });
  }
}

// Énergie annoncée pour le prochain match de l'équipe : la fatigue
// enregistrée (fin du dernier match) moins la récupération des jours de
// repos jusqu'à ce prochain match — c'est l'état dans lequel les joueurs
// l'aborderont (même calcul que la simulation). Sans match à venir, la
// fatigue enregistrée est conservée.
export async function withTipOffFatigue<P extends Player>(careerId: string, teamId: string, players: P[]): Promise<P[]> {
  if (players.length === 0) return players;
  const next = await prisma.game.findFirst({
    where: { careerId, status: { not: "final" }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { gameDate: "asc" },
    select: { gameDate: true, season: true, leagueId: true },
  });
  if (!next) return players;
  const [restDays, state, staff] = await Promise.all([
    getRestDays(careerId, teamId, next.season, next.gameDate),
    prisma.teamState.findFirst({ where: { careerId, teamId }, select: { facilitiesLevel: true } }),
    prisma.staffMember.findMany({
      where: { careerId, teamId },
      select: { teamId: true, role: true, specialty: true, rating: true, motivation: true },
    }),
  ]);
  const recoveryFactor = staff.length > 0 ? staffEffects(staffProfile(staff, next.leagueId)).fatigueRecoveryFactor : 1;
  const facilities = state?.facilitiesLevel ?? 50;
  return players.map((p) => ({
    ...p,
    fatigue: fatigueAtTipOff(p.fatigue, restDays, p.ratings.stamina, facilities, p.wear ?? 0, recoveryFactor),
  }));
}

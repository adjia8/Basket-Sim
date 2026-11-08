import "server-only";
import { prisma } from "@/lib/prisma";
import type { Player } from "@/lib/types";
import { getRosterForTeam } from "@/lib/data-access/players";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { estimatedReturnDate } from "@/lib/data-access/injuries";
import { injuryChance, injuryRiskLevel, type InjuryRiskLevel } from "@/lib/careers/injury-rules";
import { WEAR_NEEDS_REST } from "@/lib/careers/wear-rules";
import { getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE, staffEffects } from "@/lib/careers/staff-rules";
import type { TrainingFocus, TrainingIntensity } from "@/lib/careers/training-rules";

export interface MedicalRow {
  player: Player;
  riskChance: number; // probabilité de blessure sur le prochain match
  riskLevel: InjuryRiskLevel;
  needsRest: boolean;
  returnDate: Date | null; // blessé : date de retour estimée
}

export interface InjuryHistoryRow {
  id: string;
  playerId: string;
  playerName: string;
  injuryType: string;
  severity: string;
  gamesOut: number;
  gameDate: Date;
  season: string;
}

// Bilan médical d'une équipe façon Football Manager : pour chaque joueur,
// risque de blessure du prochain match (mêmes facteurs que la simulation,
// voir injuryChance), besoin de repos, date de retour s'il est blessé, et
// historique des blessures.
export async function getMedicalReport(
  careerId: string,
  teamId: string,
  leagueId: string
): Promise<{ rows: MedicalRow[]; history: InjuryHistoryRow[] }> {
  const [roster, state, lastPlayed, records, profiles] = await Promise.all([
    getRosterForTeam(careerId, teamId),
    getOrCreateTeamState(careerId, teamId, leagueId),
    prisma.game.findFirst({ where: { careerId, status: "final" }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
    prisma.injuryRecord.findMany({ where: { careerId, teamId }, orderBy: { gameDate: "desc" }, take: 30 }),
    getStaffProfiles(careerId, [teamId], leagueId),
  ]);
  const staff = staffEffects(profiles.get(teamId) ?? NEUTRAL_STAFF_PROFILE);
  const focus = state.trainingFocus as TrainingFocus | null;
  const intensity = focus && focus !== "rest" ? (state.trainingIntensity as TrainingIntensity) : null;
  const today = lastPlayed?.gameDate ?? new Date(0);

  const rows = await Promise.all(
    roster.map(async (player) => {
      const riskChance = injuryChance({
        injuryRisk: player.injuryRisk,
        fatigue: player.fatigue,
        wear: player.wear ?? 0,
        age: player.age,
        facilitiesLevel: state.facilitiesLevel,
        medicalLevel: staff.medicalLevel,
        intensity,
        played: true,
      });
      return {
        player,
        riskChance,
        riskLevel: injuryRiskLevel(riskChance),
        needsRest: (player.wear ?? 0) >= WEAR_NEEDS_REST,
        returnDate: player.injured
          ? await estimatedReturnDate(careerId, teamId, today, player.injuryGamesRemaining)
          : null,
      };
    })
  );

  const names = new Map(roster.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const missing = records.filter((r) => !names.has(r.playerId)).map((r) => r.playerId);
  if (missing.length > 0) {
    const others = await prisma.player.findMany({
      where: { id: { in: missing } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const p of others) names.set(p.id, `${p.firstName} ${p.lastName}`);
  }
  const history = records.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    playerName: names.get(r.playerId) ?? r.playerId,
    injuryType: r.injuryType,
    severity: r.severity,
    gamesOut: r.gamesOut,
    gameDate: r.gameDate,
    season: r.season,
  }));
  return { rows: rows.sort((a, b) => b.riskChance - a.riskChance), history };
}

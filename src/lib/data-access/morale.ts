import "server-only";
import type { BoxScoreEntry, Player } from "@/lib/types";
import type { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import { MORALE_NEUTRAL, clampMorale, moraleAfterGame } from "@/lib/careers/morale-rules";
import { personalityFor, scaleMoraleDelta } from "@/lib/careers/personality-rules";
import { EXPECTED_MINUTES, MINUTES_TOLERANCE, playerStatus, rankInRoster } from "@/lib/careers/player-status-rules";

// Moral individuel après un match (voir moraleAfterGame) : écrit dans
// `patches` comme les autres étapes de résolution du match. Un joueur au
// repos programmé ou blessé n'est pas pénalisé pour son temps de jeu.
export function advanceRosterMorale(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  won: boolean,
  restingIds: Set<string>,
  moraleShift = 0
): void {
  const minutesById = new Map(boxScore.map((e) => [e.playerId, e.minutesPlayed]));
  const overalls = roster.map((p) => p.overallRating);
  for (const player of roster) {
    // Objectif de temps de jeu selon son statut dans l'effectif.
    const status = playerStatus({
      overall: player.overallRating,
      renown: player.renown,
      age: player.age,
      potential: player.potential || player.overallRating,
      teamRank: rankInRoster(player.overallRating, overalls),
    });
    const current = player.morale ?? MORALE_NEUTRAL;
    const minutes = minutesById.get(player.id) ?? 0;
    const available = !player.injured && !restingIds.has(player.id);
    const next = moraleAfterGame({
      morale: current,
      played: minutes > 0,
      won,
      minutes: available ? minutes : 99,
      renown: player.renown,
      shift: moraleShift,
      expectedMinutes: EXPECTED_MINUTES[status],
      tolerance: MINUTES_TOLERANCE,
    });
    // Tempérament : un sanguin vit les résultats plus fort, un imperturbable
    // les encaisse mieux (voir personality-rules.ts).
    const scaled = clampMorale(current + scaleMoraleDelta(next - current, personalityFor(player.id, player.age)));
    if (scaled !== current) patches.set(player.id, { morale: scaled });
  }
}

import "server-only";
import type { BoxScoreEntry, Player } from "@/lib/types";
import type { PlayerStatePatches } from "@/lib/data-access/player-state-patches";
import { MORALE_NEUTRAL, moraleAfterGame } from "@/lib/careers/morale-rules";

// Moral individuel après un match (voir moraleAfterGame) : écrit dans
// `patches` comme les autres étapes de résolution du match. Un joueur au
// repos programmé ou blessé n'est pas pénalisé pour son temps de jeu.
export function advanceRosterMorale(
  patches: PlayerStatePatches,
  roster: Player[],
  boxScore: BoxScoreEntry[],
  won: boolean,
  restingIds: Set<string>
): void {
  const minutesById = new Map(boxScore.map((e) => [e.playerId, e.minutesPlayed]));
  for (const player of roster) {
    const current = player.morale ?? MORALE_NEUTRAL;
    const minutes = minutesById.get(player.id) ?? 0;
    const available = !player.injured && !restingIds.has(player.id);
    const next = moraleAfterGame({
      morale: current,
      played: minutes > 0,
      won,
      minutes: available ? minutes : 99,
      renown: player.renown,
    });
    if (next !== current) patches.set(player.id, { morale: next });
  }
}

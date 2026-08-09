// Règles pures de renommé — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/renown.ts.

// Valeur de départ dérivée de l'overall : les meilleurs joueurs démarrent déjà
// réputés, mais personne ne démarre au maximum — le renommé se gagne ensuite
// par les stats réalisées en carrière (voir renownDeltaForGame).
export function initialRenown(overallRating: number): number {
  return Math.max(10, Math.min(95, Math.round(overallRating * 0.85)));
}

// Production "attendue" pour un joueur de cet overall — repère grossier pour
// juger une performance de match (points + rebonds*1.2 + passes*1.5).
function expectedProduction(overallRating: number): number {
  return (overallRating / 99) * 30;
}

// Delta de renommé après un match, borné pour qu'aucun match seul ne
// bouleverse la note — c'est l'accumulation sur la saison qui fait la
// tendance.
export function renownDeltaForGame(
  entry: { points: number; rebounds: number; assists: number },
  overallRating: number
): number {
  const production = entry.points + entry.rebounds * 1.2 + entry.assists * 1.5;
  const ratio = production / Math.max(expectedProduction(overallRating), 8);
  return Math.max(-1.5, Math.min(1.5, (ratio - 1) * 2));
}

// Un joueur éligible mais qui ne joue pas (hors rotation, banc profond —
// jamais dans le box score) ne voit jamais son renommé ajusté par
// renownDeltaForGame, qui ne s'applique qu'aux entrées du box score : sans
// ce décompte, son renommé de départ (initialRenown, dérivé du seul overall)
// resterait figé indéfiniment, même après des dizaines de matchs sans jouer
// — un ancien "espoir" écarté de la rotation garderait un statut de star
// pour toujours.
//
// Exprimé en PROBABILITÉ d'un pas entier (-1), pas en delta fractionnaire
// fixe : renown est stocké en entier et re-arrondi à chaque appel
// (Math.round(stocké + delta)) — un delta constant de -0.3 appliqué à un
// entier redonnerait TOUJOURS le même entier (round(X - 0.3) === X, quel que
// soit le nombre de fois où on l'applique), donc n'aurait littéralement
// aucun effet. Un tirage qui vaut soit 0 soit -1 a une vraie espérance
// négative (BENCHED_RENOWN_DECAY_CHANCE par match) tout en produisant à
// chaque application un delta qui, lui, s'enregistre correctement.
export const BENCHED_RENOWN_DECAY_CHANCE = 0.3;

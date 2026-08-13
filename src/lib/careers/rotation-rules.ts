// Règles pures de rotation manuelle (5 majeures, 6ème femme, banc) — aucun
// accès base de données ici. Le rôle de chaque joueuse dans l'UI n'est
// jamais qu'une question de position dans le tableau, exactement comme côté
// moteur (voir rotationOf/ROTATION_SIZE dans simulation/mockEngine.ts) : pas
// de champ "rôle" séparé à maintenir en synchronisation.

export interface RotationOrderPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: string;
  overallRating: number;
}

// TeamState.rotationOrderJson est une chaîne libre (peut être absente,
// vide, ou corrompue si jamais modifiée hors de l'app) — jamais fait
// confiance sans validation : doit être un tableau de chaînes, sinon on
// retombe silencieusement sur "pas d'ordre" (comportement automatique du
// moteur), même convention défensive que tradeRequestReasonsJson.
export function parseRotationOrder(json: string | null | undefined): string[] | undefined {
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

// Fusionne l'ordre sauvegardé (filtré des joueuses qui ont depuis quitté
// l'équipe) avec les joueuses actuelles non encore classées (ajoutées à la
// fin, triées par overallRating décroissant — un repère simple et stable
// pour l'affichage initial, PAS le même critère que le repli réel du moteur
// (playerImpact, qui dépend de la fatigue/du conditionnement du moment) :
// ce n'est qu'une suggestion de départ que le GM ajuste, pas une garantie
// que l'ordre affiché reproduise exactement ce que ferait le moteur sans
// réglage GM.
export function mergeRotationOrder(
  roster: RotationOrderPlayer[],
  savedOrder: string[] | undefined
): RotationOrderPlayer[] {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const ordered: RotationOrderPlayer[] = [];
  const seen = new Set<string>();

  for (const id of savedOrder ?? []) {
    const player = byId.get(id);
    if (player && !seen.has(id)) {
      ordered.push(player);
      seen.add(id);
    }
  }

  const rest = roster
    .filter((p) => !seen.has(p.id))
    .sort((a, b) => b.overallRating - a.overallRating);

  return [...ordered, ...rest];
}

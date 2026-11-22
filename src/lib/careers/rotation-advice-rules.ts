// Suggestion de rotation de l'entraîneur adjoint — règles pures.
//
// L'adjoint classe les joueurs sur leur valeur du moment : note, production
// de la saison (points, rebonds, passes), fraîcheur (énergie) et usure de
// fond, puis compose un cinq équilibré par poste et un banc. Sa COMPÉTENCE
// (0-99) pèse sur la qualité du conseil : un adjoint moyen évalue moins
// finement (erreur d'appréciation stable par joueur), tient moins compte de
// la fatigue et de l'équilibre des postes.

export type Pos = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Pos[] = ["PG", "SG", "SF", "PF", "C"];

export interface AdvicePlayer {
  id: string;
  position: string;
  overall: number;
  fatigue: number; // 0-99 (énergie = 100 - fatigue)
  wear: number; // 0-99
  injured: boolean;
  injurySeverity?: string | null;
  playingThroughInjury?: boolean;
  ppg: number;
  rpg: number;
  apg: number;
}

export type AdviceNote =
  | { kind: "starter"; pos: Pos; offPosition: boolean }
  | { kind: "sixth" }
  | { kind: "bench" }
  | { kind: "rest"; energy: number } // trop fatigué : hors rotation ce soir
  | { kind: "wear"; wear: number } // usure élevée : minutes réduites (fin de banc)
  | { kind: "injured" }
  | { kind: "reserve" };

export interface RotationAdvice {
  order: string[]; // 10 premiers = rotation active (5 titulaires, puis le banc)
  notes: Record<string, AdviceNote>;
  confidence: "high" | "medium" | "low";
}

export const ACTIVE_ROTATION = 10;

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2001) / 1000 - 1; // [-1, 1]
}

const ADJACENT: Record<Pos, Pos[]> = {
  PG: ["SG"],
  SG: ["PG", "SF"],
  SF: ["SG", "PF"],
  PF: ["SF", "C"],
  C: ["PF"],
};

export function rotationAdvice(players: AdvicePlayer[], skill: number, seed = ""): RotationAdvice {
  const s = Math.max(0, Math.min(99, skill)) / 99;
  const fatigueWeight = 0.4 + 0.6 * s; // un bon adjoint ménage vraiment les organismes
  const noise = (1 - s) * 6; // erreur d'appréciation (points de note)
  const restThreshold = 72 - Math.round(s * 12); // énergie sous laquelle il conseille le repos (≈ 60-72 %)

  const notes: Record<string, AdviceNote> = {};
  const available: AdvicePlayer[] = [];
  const injured: AdvicePlayer[] = [];
  const resting: AdvicePlayer[] = [];
  for (const p of players) {
    if (p.injured && !(p.playingThroughInjury && p.injurySeverity === "minor")) {
      injured.push(p);
      notes[p.id] = { kind: "injured" };
    } else if (100 - p.fatigue < restThreshold && s >= 0.35) {
      resting.push(p);
      notes[p.id] = { kind: "rest", energy: 100 - p.fatigue };
    } else {
      available.push(p);
    }
  }

  // Valeur du moment : note + production (plafonnée) − fatigue − usure,
  // vue à travers l'œil (plus ou moins juste) de l'adjoint.
  const production = (p: AdvicePlayer) => Math.min(8, p.ppg * 0.22 + p.rpg * 0.15 + p.apg * 0.2);
  const score = (p: AdvicePlayer) =>
    p.overall +
    production(p) -
    fatigueWeight * Math.max(0, p.fatigue - 25) * 0.15 -
    Math.max(0, p.wear - 60) * 0.12 +
    seeded(`${seed}:${p.id}`) * noise;
  const ranked = [...available].sort((a, b) => score(b) - score(a));

  // Cinq de départ par poste (un poste voisin dépanne, avec un léger malus ;
  // un adjoint faible s'en soucie moins et prend surtout les meilleurs).
  // Meilleure combinaison globale des cinq (recherche exhaustive sur les dix
  // meilleurs candidats) : évite de caser un pivot à l'aile forte pendant
  // qu'un ailier fort dépanne au pivot.
  const posPenalty = 3 * s;
  const fit = (p: AdvicePlayer, pos: Pos): number | null => {
    if (p.position === pos) return score(p);
    if (ADJACENT[pos].includes(p.position as Pos)) return score(p) - posPenalty;
    return s >= 0.3 ? null : score(p) - posPenalty * 2;
  };
  const pool = ranked.slice(0, 10);
  let bestCombo: { p: AdvicePlayer; pos: Pos; off: boolean }[] = [];
  let bestValue = -Infinity;
  const search = (i: number, picked: { p: AdvicePlayer; pos: Pos; off: boolean }[], value: number, taken: Set<string>) => {
    if (i === POSITIONS.length) {
      if (value > bestValue) {
        bestValue = value;
        bestCombo = [...picked];
      }
      return;
    }
    const pos = POSITIONS[i];
    let any = false;
    for (const p of pool) {
      if (taken.has(p.id)) continue;
      const v = fit(p, pos);
      if (v === null) continue;
      any = true;
      taken.add(p.id);
      picked.push({ p, pos, off: p.position !== pos });
      search(i + 1, picked, value + v, taken);
      picked.pop();
      taken.delete(p.id);
    }
    if (!any) search(i + 1, picked, value, taken); // poste impossible à couvrir : laissé vide
  };
  search(0, [], 0, new Set());
  const starters = bestCombo;
  const used = new Set(starters.map((st) => st.p.id));
  for (const st of starters) notes[st.p.id] = { kind: "starter", pos: st.pos, offPosition: st.off };

  // Banc : le reste par valeur ; usure très élevée → en fin de rotation.
  const bench = ranked.filter((p) => !used.has(p.id));
  const fresh = bench.filter((p) => p.wear < 75 || s < 0.35);
  const worn = bench.filter((p) => !(p.wear < 75 || s < 0.35));
  const benchOrder = [...fresh, ...worn];
  benchOrder.forEach((p, i) => {
    const slot = starters.length + i;
    if (slot >= ACTIVE_ROTATION) notes[p.id] = { kind: "reserve" };
    else if (p.wear >= 75 && s >= 0.35) notes[p.id] = { kind: "wear", wear: p.wear };
    else notes[p.id] = i === 0 ? { kind: "sixth" } : { kind: "bench" };
  });

  const order = [
    ...starters.map((st) => st.p.id),
    ...benchOrder.map((p) => p.id),
    ...resting.sort((a, b) => b.overall - a.overall).map((p) => p.id),
    ...injured.sort((a, b) => b.overall - a.overall).map((p) => p.id),
  ];
  return { order, notes, confidence: s >= 0.7 ? "high" : s >= 0.45 ? "medium" : "low" };
}

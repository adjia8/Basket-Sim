// Plan de retour de blessure — règles pures, sans accès base de données.
//
// Pendant une blessure modérée ou grave, le staff médical propose un
// protocole :
// - standard : retour une fois guéri, sans précaution particulière ;
// - progressif : au retour, temps de jeu limité pendant quelques matchs,
//   risque de rechute réduit de moitié ;
// - accéléré : retour ≈ 30 % plus tôt, mais risque de rechute nettement
//   plus élevé sur les matchs qui suivent, et une rechute est plus grave.

export type ReturnProtocol = "standard" | "progressive" | "rushed";
export const RETURN_PROTOCOLS: ReturnProtocol[] = ["standard", "progressive", "rushed"];

export const PROTOCOL_GAMES: Record<ReturnProtocol, number> = { standard: 0, progressive: 4, rushed: 5 };
export const PROGRESSIVE_MINUTES_CAP = 20;

export function protocolAllowed(severity: string | null | undefined): boolean {
  return severity === "moderate" || severity === "severe";
}

// Matchs d'absence restants si l'on accélère le retour (au moins 1).
export function rushedRemaining(remaining: number): number {
  return Math.max(1, Math.round(remaining * 0.7));
}

// Multiplicateur du risque de blessure pendant les matchs qui suivent le retour.
export function protocolRiskMultiplier(protocol: ReturnProtocol | null, gamesLeft: number): number {
  if (!protocol || gamesLeft <= 0) return 1;
  return protocol === "progressive" ? 0.5 : protocol === "rushed" ? 2.5 : 1;
}

// Plafonne les minutes de certains joueurs sur une période et redistribue
// l'excédent aux autres, au prorata (le total de minutes reste le même).
export function capMinutes(ids: string[], minutes: number[], capFor: (id: string) => number | undefined): number[] {
  const out = [...minutes];
  let excess = 0;
  ids.forEach((id, i) => {
    const cap = capFor(id);
    if (cap !== undefined && out[i] > cap) {
      excess += out[i] - cap;
      out[i] = cap;
    }
  });
  if (excess <= 0) return out;
  const free = ids.map((id, i) => (capFor(id) === undefined ? i : -1)).filter((i) => i >= 0);
  const base = free.reduce((s, i) => s + out[i], 0);
  if (base <= 0) return out;
  for (const i of free) out[i] += (excess * out[i]) / base;
  return out;
}

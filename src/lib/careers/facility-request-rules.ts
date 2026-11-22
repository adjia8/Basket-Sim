// Demandes d'installations des joueurs — règles pures.
//
// Un joueur renommé réclame l'installation qui compte pour LUI : un
// vétéran ou un joueur usé veut un centre de récupération, un joueur
// souvent blessé un centre médical, un jeune à fort potentiel un labo de
// performance. Le GM peut lancer le chantier (demande satisfaite à la
// livraison), le lui promettre (délai), ou l'ignorer. Promesse tenue :
// moral en hausse ; rompue : moral en baisse, voire demande d'échange.

import type { ProjectKey } from "./facility-projects-rules";

export const FACILITY_REQUEST_RENOWN = 65;
export const FACILITY_REQUEST_CHANCE = 0.03; // par match, avant tempérament
export const FACILITY_PROMISE_DAYS = 90; // délai pour LANCER le chantier promis
export const FACILITY_DELIVERED_MORALE = 6;
export const FACILITY_STARTED_MORALE = 3;
export const FACILITY_BROKEN_MORALE = -10;

export interface FacilityNeedContext {
  age: number;
  renown: number;
  overall: number;
  potential: number;
  wear: number;
  injuriesThisSeason: number;
}

// Installation voulue par ce joueur (et palier minimum), d'après sa
// situation et ce qui existe déjà (`tierOf` : palier effectif du club).
export function desiredFacility(
  c: FacilityNeedContext,
  tierOf: (key: ProjectKey) => number,
  maxTierOf: (key: ProjectKey) => number
): { key: ProjectKey; tier: number } | null {
  if (c.renown < FACILITY_REQUEST_RENOWN) return null;
  const want = (key: ProjectKey, min: number) => {
    const tier = tierOf(key);
    return tier < Math.min(min, maxTierOf(key)) ? { key, tier: tier + 1 } : null;
  };
  if (c.injuriesThisSeason >= 2) return want("medical_center", 2);
  if (c.age >= 30 || c.wear >= 60) return want("recovery_center", 2);
  if (c.age <= 24 && c.potential >= c.overall + 4) return want("performance_lab", 2);
  return null;
}

export type FacilityRequestOutcome = "delivered" | "started" | "broken" | "waiting";

// Où en est la demande : installation livrée (palier atteint), chantier
// lancé, promesse expirée, ou toujours en attente.
export function facilityRequestOutcome(p: {
  currentTier: number;
  wantedTier: number;
  building: boolean;
  promiseBy: Date | null;
  today: Date;
}): FacilityRequestOutcome {
  if (p.currentTier >= p.wantedTier) return "delivered";
  if (p.building) return "started";
  if (p.promiseBy && p.today.getTime() > p.promiseBy.getTime()) return "broken";
  return "waiting";
}

// Règles pures de fatigue — aucun accès base de données ici, tout est piloté
// par src/lib/data-access/fatigue.ts. La fatigue est l'énergie du moment
// (remonte en quelques jours) ; l'usure, fatigue de fond qui ralentit cette
// récupération, est dans wear-rules.ts.

import { energyRecoveryFactor } from "./wear-rules";

// Gain de fatigue après un match, proportionnel aux minutes jouées et plus
// faible pour une bonne `stamina` : pour 36 minutes, +30 à stamina 0, +14 à
// stamina 99 (un remplaçant à 15 minutes se fatigue bien moins).
export function fatigueGainForGame(stamina: number, minutes = 36): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  return Math.round((Math.max(0, Math.min(48, minutes)) / 36) * (30 - t * 16));
}

// Part de la fatigue récupérée par jour de repos (≈ un tiers) : selon la
// `stamina` (27 % à 0, 40 % à 99), les infrastructures (±20 %, 50 = neutre),
// l'usure (jusqu'à −40 %) et un facteur externe (préparateurs physiques,
// centre de récupération).
export function dailyRecoveryRate(stamina: number, facilitiesLevel = 50, wear = 0, factor = 1): number {
  const t = Math.max(0, Math.min(99, stamina)) / 99;
  const facilitiesFactor = 1 + ((Math.max(0, Math.min(100, facilitiesLevel)) - 50) / 50) * 0.2;
  return Math.max(0.08, Math.min(0.6, (0.27 + t * 0.13) * facilitiesFactor * energyRecoveryFactor(wear) * factor));
}

// Fatigue au coup d'envoi du prochain match : la fatigue de fin de match
// décroît d'environ un tiers par jour de repos (récupération exponentielle :
// rapide quand on est épuisé, jamais tout à fait complète d'un match sur
// l'autre pour un titulaire très utilisé — un back-to-back se sent).
// Appliquée avant le match (moteur) et à l'affichage (énergie annoncée).
export function fatigueAtTipOff(
  fatigue: number,
  restDays: number,
  stamina: number,
  facilitiesLevel = 50,
  wear = 0,
  recoveryFactor = 1
): number {
  const r = dailyRecoveryRate(stamina, facilitiesLevel, wear, recoveryFactor);
  return Math.max(0, Math.round(fatigue * Math.pow(1 - r, Math.max(0, restDays))));
}

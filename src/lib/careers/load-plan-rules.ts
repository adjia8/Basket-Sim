// Plan de gestion de la charge d'un joueur (valable toute la saison) —
// règles pures, sans accès base de données.
//
// Au lieu de le mettre au repos match par match, le GM fixe des règles :
// repos sur le 2e match d'un back-to-back, limite de minutes, repos
// automatique au-delà d'un seuil d'usure. Pratique pour un vétéran fragile
// ou une star à préserver.

export interface LoadPlan {
  restOnBackToBacks: boolean;
  minutesLimit: number | null; // minutes maximales par match
  autoRestWear: number | null; // repos automatique dès cette usure (0-99)
}

export const MINUTES_LIMITS = [24, 28, 32];
export const AUTO_REST_WEAR_LEVELS = [60, 70, 80];

export function parseLoadPlan(json: string | null | undefined): LoadPlan | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<LoadPlan>;
    const plan: LoadPlan = {
      restOnBackToBacks: !!p.restOnBackToBacks,
      minutesLimit: p.minutesLimit && MINUTES_LIMITS.includes(p.minutesLimit) ? p.minutesLimit : null,
      autoRestWear: p.autoRestWear && AUTO_REST_WEAR_LEVELS.includes(p.autoRestWear) ? p.autoRestWear : null,
    };
    return isEmptyPlan(plan) ? null : plan;
  } catch {
    return null;
  }
}

export function isEmptyPlan(p: LoadPlan): boolean {
  return !p.restOnBackToBacks && p.minutesLimit === null && p.autoRestWear === null;
}

// Le plan met-il ce joueur au repos pour ce match ?
export function planRests(plan: LoadPlan | null, ctx: { restDays: number; wear: number }): boolean {
  if (!plan) return false;
  if (plan.restOnBackToBacks && ctx.restDays <= 1) return true;
  if (plan.autoRestWear !== null && ctx.wear >= plan.autoRestWear) return true;
  return false;
}

// Plafond de minutes effectif : le plus strict entre le plan et un éventuel
// protocole de retour de blessure.
export function effectiveMinutesCap(plan: LoadPlan | null, protocolCap: number | null): number | null {
  const caps = [plan?.minutesLimit ?? null, protocolCap].filter((c): c is number => c !== null);
  return caps.length ? Math.min(...caps) : null;
}

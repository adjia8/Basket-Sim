// Types de promesse qu'un GM peut faire à une joueuse qui veut être
// échangée — voir src/lib/data-access/trade-requests.ts pour le
// déclenchement/l'évaluation, et src/app/actions/promise.ts pour l'action
// serveur. Libellés dans src/lib/i18n/dict/domain.ts (clé
// `domain.promiseType.<valeur>`).
//
// Volontairement AUCUNE promesse "amélioration du marché" : Team.marketAppeal
// est une valeur figée du catalogue, jamais modifiée en cours de carrière —
// une telle promesse ne pourrait littéralement jamais être tenue. Une
// joueuse insatisfaite du marché n'a que la promesse "trade" comme vrai
// recours.
export type PromiseType = "renewal" | "trade" | "facilities" | "competitiveness";
export const PROMISE_TYPES: PromiseType[] = ["renewal", "trade", "facilities", "competitiveness"];

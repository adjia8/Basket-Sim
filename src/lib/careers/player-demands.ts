// Règles pures d'exigences des joueurs (salaire, compétitivité, marché) — pas
// d'accès base de données ici, tout est piloté par src/app/actions/roster.ts
// et les pages qui affichent ces exigences avant de laisser cliquer.

import { SALARY_RANGES, baseSalaryFloor } from "./salary-rules";
import { ALT_CONTRACT_AGE_LIMIT } from "./contract-type-rules";

// À partir de ce renommé, un joueur devient "star" : il exige en plus une
// équipe compétitive et un marché attractif (en dessous, seul le salaire compte).
export const STAR_RENOWN_THRESHOLD = 70;
export const COMPETITIVE_WIN_PCT_THRESHOLD = 0.45;
export const ATTRACTIVE_MARKET_THRESHOLD = 60;
export const ATTRACTIVE_FACILITIES_THRESHOLD = 60;
// Même échelle qu'ATTRACTIVE_FACILITIES_THRESHOLD — utilisé uniquement par la
// promesse "facilities" (voir evaluatePendingPromises dans trade-requests.ts),
// pas par tradeRequestReasons ci-dessous (qui ne regarde que facilitiesLevel).
export const ATTRACTIVE_TRAINING_STAFF_THRESHOLD = 60;

// Rythme de déclenchement d'une NOUVELLE demande de trade — voir
// maybeFlagTradeRequest dans src/lib/data-access/trade-requests.ts. Avant
// l'ajout de ces constantes, tradeRequestReasons() était recalculée en
// direct à chaque rendu de page, donc "vouloir partir" était instantané et
// permanent dès que les seuils ci-dessus étaient franchis — sur un roster
// avec plusieurs joueuses "star", ça faisait presque toujours 2-3 demandes
// simultanées dès le premier match. Le déclenchement réel passe désormais
// par un tirage probabiliste sous double cooldown (par joueuse ET par
// équipe), même principe que PRESS_CONFERENCE_COOLDOWN_DAYS/_CHANCE dans
// press-rules.ts — délibérément plus rare, une demande de trade pèse plus
// lourd qu'une conférence de presse.
export const TRADE_REQUEST_MIN_GAMES_PLAYED = 5;
export const TRADE_REQUEST_CHECK_COOLDOWN_DAYS = 21;
export const TEAM_TRADE_REQUEST_COOLDOWN_DAYS = 21;
export const TRADE_REQUEST_CHANCE = 0.12;

// Une joueuse encore en tout début de carrière (même seuil d'âge que
// l'éligibilité aux contrats alternatifs, ALT_CONTRACT_AGE_LIMIT) n'a pas
// le vécu pour crédiblement exiger un traitement de star sur la seule foi
// de son renommé initial (qui peut déjà être élevé rien qu'à partir de son
// overall) — il lui faut un renommé nettement supérieur à une vétérane
// confirmée avant que ses exigences comptent. Ne s'applique qu'aux demandes
// de trade (tradeRequestReasons) : le refus de signer/prolonger reste géré
// séparément par minAcceptableSalary, hors périmètre ici.
export const YOUNG_PLAYER_AGE_LIMIT = ALT_CONTRACT_AGE_LIMIT;
export const YOUNG_PLAYER_RENOWN_PREMIUM = 15;

function starRenownThresholdForAge(age: number): number {
  return age <= YOUNG_PLAYER_AGE_LIMIT
    ? STAR_RENOWN_THRESHOLD + YOUNG_PLAYER_RENOWN_PREMIUM
    : STAR_RENOWN_THRESHOLD;
}

// Salaire plancher accepté par un joueur, dérivé de son renommé — nul jusqu'au
// renommé "moyen" (50, comportement inchangé pour un joueur non renommé),
// jusqu'à +60% de prime au renommé maximal. Utilise le barème DÉTERMINISTE
// (baseSalaryFloor, sans variance aléatoire) : cette fonction sert à évaluer
// un état existant (refus de signer/prolonger), pas à générer un nouveau
// contrat — un plancher qui change à chaque appel rendrait ces décisions
// incohérentes d'un rendu à l'autre.
export function minAcceptableSalary(
  renown: number,
  overallRating: number,
  leagueId: string
): number {
  const range = SALARY_RANGES[leagueId] ?? SALARY_RANGES.nba;
  const baseline = baseSalaryFloor(overallRating, range);
  const premium = (Math.max(0, renown - 50) / 49) * 0.6;
  return Math.round(baseline * (1 + premium));
}

export function wantsCompetitiveTeam(renown: number): boolean {
  return renown >= STAR_RENOWN_THRESHOLD;
}

export function wantsAttractiveMarket(renown: number): boolean {
  return renown >= STAR_RENOWN_THRESHOLD;
}

// Un joueur renommé veut aussi de bonnes infrastructures d'entraînement —
// distinct de l'attractivité du marché (une ville peu attractive peut avoir
// d'excellentes infrastructures, et inversement).
export function wantsGoodFacilities(renown: number): boolean {
  return renown >= STAR_RENOWN_THRESHOLD;
}

// Bilan de victoires exploitable pour juger la compétitivité d'une équipe —
// neutre (0.5) tant qu'aucun match n'a encore été joué cette saison, pour ne
// pas bloquer les signatures en tout début de saison.
export function winPctForStandings(wins: number, losses: number): number {
  const total = wins + losses;
  return total === 0 ? 0.5 : wins / total;
}

export function teamMeetsPlayerDemands(params: {
  renown: number;
  teamWinPct: number;
  teamMarketAppeal: number;
  teamFacilitiesLevel: number;
}): boolean {
  if (params.renown < STAR_RENOWN_THRESHOLD) return true;
  return (
    params.teamWinPct >= COMPETITIVE_WIN_PCT_THRESHOLD &&
    params.teamMarketAppeal >= ATTRACTIVE_MARKET_THRESHOLD &&
    params.teamFacilitiesLevel >= ATTRACTIVE_FACILITIES_THRESHOLD
  );
}

export type TradeRequestReason = "competitiveness" | "market" | "facilities";

// Libellés dans src/lib/i18n/dict/domain.ts (clé `domain.tradeReason.<valeur>`)
// — pas de texte affichable dans ce fichier de règles pures.

// Détaille CE QUI, précisément, pousse un joueur à vouloir être échangé —
// mêmes seuils que teamMeetsPlayerDemands, mais renvoie la liste des raisons
// plutôt qu'un simple booléen (affiché sur la fiche joueur). Un joueur peut
// cumuler plusieurs raisons à la fois.
//
// Volontairement AUCUNE raison liée au salaire ici : un échange ne change en
// rien le contrat d'un joueur (il est repris tel quel par la nouvelle
// équipe), donc "je veux être échangé pour être mieux payé" n'a pas de sens
// — un joueur sous-payé refuse plutôt de signer/prolonger (voir
// minAcceptableSalary, utilisé par extendContract/signFreeAgent), il ne
// demande pas un échange pour ça.
export function tradeRequestReasons(params: {
  renown: number;
  age: number;
  teamWinPct: number;
  teamMarketAppeal: number;
  teamFacilitiesLevel: number;
}): TradeRequestReason[] {
  const reasons: TradeRequestReason[] = [];
  if (params.renown >= starRenownThresholdForAge(params.age)) {
    if (params.teamWinPct < COMPETITIVE_WIN_PCT_THRESHOLD) reasons.push("competitiveness");
    if (params.teamMarketAppeal < ATTRACTIVE_MARKET_THRESHOLD) reasons.push("market");
    if (params.teamFacilitiesLevel < ATTRACTIVE_FACILITIES_THRESHOLD) reasons.push("facilities");
  }
  return reasons;
}

// Valeur d'échange d'un joueur : son overallRating, cohérent avec le barème de
// salaire déjà basé dessus (src/lib/careers/generate-contracts.ts) — pas besoin
// d'une deuxième échelle.
export function tradeValue(overallRating: number): number {
  return overallRating;
}

// Valeur d'échange réaliste (utilisée par l'IA pour juger un échange) : elle
// croît de plus en plus vite avec la note — une star de 92 vaut bien plus que
// deux joueurs de 75 (avec l'ancienne somme des notes, on pouvait arracher
// une star à l'IA contre deux remplaçants). Bonus de jeunesse, décote des
// vétérans.
export function playerTradeValue(overallRating: number, age: number): number {
  const base = Math.pow(Math.max(0, overallRating - 55), 1.8);
  const ageFactor = age <= 22 ? 1.15 : age <= 25 ? 1.05 : age >= 34 ? 0.75 : age >= 31 ? 0.9 : 1;
  return Math.round(base * ageFactor);
}

// Un pick sur la même échelle que playerTradeValue (via sa valeur 55-82).
export function pickTradeValue(round: number, pickNumber: number | null, picksPerRound: number): number {
  return Math.round(Math.pow(Math.max(0, draftPickTradeValue(round, pickNumber, picksPerRound) - 55), 1.8));
}

// Valeur d'échange d'un pick de draft, sur la même échelle que tradeValue
// (0-99), calée sur la plage réelle des prospects générés (55-82, voir
// generate-prospects.ts) — décroissante du 1er pick du 1er tour (le plus
// valorisé) au dernier pick du 2e tour. Pour un pick futur pas encore résolu
// (pickNumber inconnu), utilise la valeur moyenne du tour concerné.
const PICK_VALUE_MAX = 82;
const PICK_VALUE_MIN = 55;

export function draftPickTradeValue(
  round: number,
  pickNumber: number | null,
  picksPerRound: number
): number {
  const totalPicks = picksPerRound * 2;
  const valueAtPosition = (position: number) => {
    const t = totalPicks > 1 ? (position - 1) / (totalPicks - 1) : 0;
    return PICK_VALUE_MAX - t * (PICK_VALUE_MAX - PICK_VALUE_MIN);
  };
  if (pickNumber === null) {
    const roundStart = round === 1 ? 1 : picksPerRound + 1;
    const roundEnd = round === 1 ? picksPerRound : totalPicks;
    return Math.round(valueAtPosition((roundStart + roundEnd) / 2));
  }
  return Math.round(valueAtPosition(pickNumber));
}

// L'IA accepte si la valeur qu'elle reçoit vaut au moins 90% de ce qu'elle donne.
// Assez permissif pour rester jouable, assez strict pour bloquer les échanges
// absurdes (ex: un joueur de banc contre une superstar).
export const TRADE_ACCEPT_TOLERANCE = 0.9;

// Date limite des échanges : pas de vraie horloge murale dans ce jeu (le temps
// n'avance qu'au fil des matchs simulés), donc calée sur la progression de la
// saison en cours plutôt que sur une date — comme la vraie date limite NBA,
// qui tombe aux alentours des deux tiers de la saison régulière.
export const TRADE_DEADLINE_SEASON_FRACTION = 0.65;

// ---------------------------------------------------------------------------
// Effectif et masse salariale autour d'un échange

// Seuls les contrats standard comptent dans la masse salariale et l'effectif
// (les two-way / développement ont leurs propres places, hors plafond).
export function capSalary(contracts: { salary: number; contractType: string }[]): number {
  return contracts.filter((c) => c.contractType === "standard").reduce((s, c) => s + c.salary, 0);
}

export interface RosterMove {
  standardBefore: number;
  altBefore: number;
  standardOut: number;
  altOut: number;
  standardIn: number;
  altIn: number;
}

// Effectif après échange : bloque seulement si l'échange AGGRAVE un
// dépassement (une équipe déjà hors limites peut échanger à effectif
// constant), pour les contrats standard comme pour les places two-way.
export function rosterMoveAllowed(m: RosterMove, min: number, max: number, altSlots: number): boolean {
  const std = m.standardBefore - m.standardOut + m.standardIn;
  const alt = m.altBefore - m.altOut + m.altIn;
  const exceeds = std > max && std > m.standardBefore;
  const below = std < min && std < m.standardBefore;
  const altOver = alt > altSlots && alt > m.altBefore;
  return !exceeds && !below && !altOver;
}

// ---------------------------------------------------------------------------
// Intérêt de l'IA selon sa situation

export type TeamOutlook = "contender" | "middle" | "rebuild";

// Profil d'une équipe : son bilan dès 15 matchs, avant cela l'objectif fixé
// en début de saison (calculé d'après la force de l'effectif).
export function teamOutlook(params: { winPct: number; gamesPlayed: number; expectation: string | null }): TeamOutlook {
  if (params.gamesPlayed >= 15) {
    if (params.winPct >= 0.58) return "contender";
    if (params.winPct <= 0.42) return "rebuild";
    return "middle";
  }
  if (params.expectation === "rebuild") return "rebuild";
  if (params.expectation && ["conf_finals", "nba_finals", "champion"].includes(params.expectation)) return "contender";
  return "middle";
}

export type TradeAsset =
  | { kind: "player"; overall: number; age: number; salary: number; standard: boolean }
  | { kind: "pick"; round: number; pickNumber: number | null };

// Valeur d'un élément pour une équipe donnée : une équipe en reconstruction
// paie cher les jeunes et les choix de draft et boude les vétérans ; une
// équipe qui joue le titre veut des joueurs utiles tout de suite.
export function assetValueFor(outlook: TeamOutlook, asset: TradeAsset, picksPerRound: number): number {
  if (asset.kind === "pick") {
    const base = pickTradeValue(asset.round, asset.pickNumber, picksPerRound);
    if (outlook === "rebuild") return base * (asset.round === 1 ? 1.4 : 1.2);
    if (outlook === "contender") return base * 0.7;
    return base;
  }
  const base = playerTradeValue(asset.overall, asset.age);
  if (outlook === "rebuild") {
    if (asset.age <= 24) return base * 1.25;
    if (asset.age >= 30) return base * 0.65;
    if (asset.age >= 27) return base * 0.9;
    return base;
  }
  if (outlook === "contender") {
    if (asset.age >= 26 && asset.overall >= 76) return base * 1.15;
    if (asset.age <= 22 && asset.overall < 74) return base * 0.8;
  }
  return base;
}

export type TradeRefusal = "value" | "rebuild" | "contender" | "salary";

export interface AiTradeDecision {
  accept: boolean;
  reason: TradeRefusal | null;
  received: number; // valeur reçue, ajustée (profil + masse salariale)
  given: number;
}

// Décision de l'IA : valeur reçue (selon son profil, corrigée de l'impact
// sur sa masse salariale) contre valeur cédée, avec la tolérance habituelle.
// Masse salariale : une équipe en reconstruction fuit les salaires en plus
// et apprécie d'en libérer ; toute équipe rechigne à passer la taxe de luxe.
export function evaluateTradeForAi(params: {
  outlook: TeamOutlook;
  received: TradeAsset[];
  given: TradeAsset[];
  picksPerRound: number;
  payrollBefore: number;
  taxLine: number;
}): AiTradeDecision {
  const { outlook, picksPerRound } = params;
  const sum = (list: TradeAsset[]) => list.reduce((s, a) => s + assetValueFor(outlook, a, picksPerRound), 0);
  const salaryOf = (list: TradeAsset[]) =>
    list.reduce((s, a) => s + (a.kind === "player" && a.standard ? a.salary : 0), 0);
  const salaryIn = salaryOf(params.received);
  const salaryOut = salaryOf(params.given);
  const netMillions = (salaryIn - salaryOut) / 1_000_000;
  const payrollAfter = params.payrollBefore - salaryOut + salaryIn;
  let salaryAdjust = 0;
  if (outlook === "rebuild") salaryAdjust += netMillions > 0 ? -5 * netMillions : -3 * netMillions;
  else if (outlook === "middle" && netMillions > 0) salaryAdjust -= 1.5 * netMillions;
  // Taxe de luxe : seulement la part de salaire ajoutée au-dessus de la ligne.
  const overTaxAdded = Math.max(0, payrollAfter - Math.max(params.taxLine, params.payrollBefore)) / 1_000_000;
  salaryAdjust -= 4 * overTaxAdded;

  const rawReceived = sum(params.received);
  const received = rawReceived + salaryAdjust;
  const given = sum(params.given);
  const accept = received >= given * TRADE_ACCEPT_TOLERANCE;
  if (accept) return { accept, reason: null, received, given };
  // Raison principale du refus, pour l'expliquer au joueur.
  const neutralReceived = params.received.reduce(
    (s, a) => s + (a.kind === "pick" ? pickTradeValue(a.round, a.pickNumber, picksPerRound) : playerTradeValue(a.overall, a.age)),
    0
  );
  const neutralGiven = params.given.reduce(
    (s, a) => s + (a.kind === "pick" ? pickTradeValue(a.round, a.pickNumber, picksPerRound) : playerTradeValue(a.overall, a.age)),
    0
  );
  const fairOnValue = neutralReceived >= neutralGiven * TRADE_ACCEPT_TOLERANCE;
  let reason: TradeRefusal = "value";
  if (fairOnValue && rawReceived >= given * TRADE_ACCEPT_TOLERANCE) reason = "salary";
  else if (fairOnValue) reason = outlook === "rebuild" ? "rebuild" : outlook === "contender" ? "contender" : "value";
  return { accept, reason, received, given };
}

// ---------------------------------------------------------------------------
// Centre des transferts : jauge d'intérêt et suggestion de complément

export type TradeInterest = "high" | "medium" | "low" | "none";

// Intérêt de l'IA d'après le rapport valeur reçue / valeur cédée (déjà
// ajusté de son profil et de sa masse salariale) : « medium » et plus = elle
// accepterait l'échange tel quel.
export function tradeInterest(decision: Pick<AiTradeDecision, "received" | "given">): TradeInterest {
  const ratio = decision.given <= 0 ? 2 : decision.received / decision.given;
  if (ratio >= TRADE_ACCEPT_TOLERANCE + 0.25) return "high";
  if (ratio >= TRADE_ACCEPT_TOLERANCE) return "medium";
  if (ratio >= TRADE_ACCEPT_TOLERANCE - 0.2) return "low";
  return "none";
}

export interface TradeCandidate {
  id: string;
  asset: TradeAsset;
  allowed: boolean; // ajout possible sans enfreindre effectif / règles salariales
}

// Plus petit ajout de MON côté qui ferait accepter l'échange : on essaie
// chaque élément disponible (choix de draft, joueurs) et on garde celui qui
// suffit en coûtant le moins (valeur « neutre », hors profil de l'IA).
export function smallestSufficientAddition(params: {
  outlook: TeamOutlook;
  received: TradeAsset[];
  given: TradeAsset[];
  candidates: TradeCandidate[];
  picksPerRound: number;
  payrollBefore: number;
  taxLine: number;
}): TradeCandidate | null {
  const neutral = (a: TradeAsset) =>
    a.kind === "pick" ? pickTradeValue(a.round, a.pickNumber, params.picksPerRound) : playerTradeValue(a.overall, a.age);
  const sufficient = params.candidates.filter(
    (c) =>
      c.allowed &&
      evaluateTradeForAi({
        outlook: params.outlook,
        received: [...params.received, c.asset],
        given: params.given,
        picksPerRound: params.picksPerRound,
        payrollBefore: params.payrollBefore,
        taxLine: params.taxLine,
      }).accept
  );
  return sufficient.sort((a, b) => neutral(a.asset) - neutral(b.asset))[0] ?? null;
}

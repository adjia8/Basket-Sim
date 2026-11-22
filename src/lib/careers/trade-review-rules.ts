// Échanges : avis de l'entraîneur adjoint sur une offre, et réactions des
// fans et de la direction une fois l'échange conclu — règles pures.
//
// L'avis reprend la même valeur d'échange que l'IA (voir trade-rules.ts),
// vue depuis NOTRE situation (reconstruction, milieu de tableau, course au
// titre) et corrigée de l'impact sur la masse salariale. La COMPÉTENCE de
// l'adjoint (0-99) pèse sur la justesse du verdict (erreur d'appréciation)
// et sur le nombre d'arguments qu'il relève.

import { evaluateTradeForAi, playerTradeValue, pickTradeValue, type TeamOutlook, type TradeAsset } from "./trade-rules";

export type ReviewPlayer = {
  kind: "player";
  id: string;
  name: string;
  position: string;
  overall: number;
  age: number;
  salary: number;
  standard: boolean;
  yearsRemaining: number;
  renown: number;
};
export type ReviewPick = { kind: "pick"; id: string; round: number; pickNumber: number | null };
export type ReviewAsset = ReviewPlayer | ReviewPick;

export type TradeVerdict = "big_gain" | "gain" | "even" | "loss" | "big_loss";

export type ReviewPoint =
  | { kind: "upgrade"; name: string; overall: number }
  | { kind: "downgrade"; name: string; overall: number }
  | { kind: "younger"; years: number }
  | { kind: "older"; years: number }
  | { kind: "salarySaved"; amount: number }
  | { kind: "salaryAdded"; amount: number }
  | { kind: "taxCrossed" }
  | { kind: "badContract"; name: string; years: number }
  | { kind: "expiring"; name: string }
  | { kind: "picksGained"; count: number }
  | { kind: "picksLost"; count: number }
  | { kind: "positionGap"; position: string }
  | { kind: "veteranForRebuild"; name: string }
  | { kind: "weakensNow" }
  | { kind: "fanFavourite"; name: string };

export interface TradeReview {
  verdict: TradeVerdict;
  ratio: number; // valeur reçue / valeur cédée, telle que l'adjoint la perçoit
  confidence: "high" | "medium" | "low";
  points: ReviewPoint[];
  salaryNet: number; // + = masse salariale qui augmente
}

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2001) / 1000 - 1; // [-1, 1]
}

const asTradeAsset = (a: ReviewAsset): TradeAsset =>
  a.kind === "pick"
    ? { kind: "pick", round: a.round, pickNumber: a.pickNumber }
    : { kind: "player", overall: a.overall, age: a.age, salary: a.salary, standard: a.standard };

const players = (list: ReviewAsset[]) => list.filter((a): a is ReviewPlayer => a.kind === "player");
const salaryOf = (list: ReviewAsset[]) => players(list).reduce((s, p) => s + (p.standard ? p.salary : 0), 0);

// Âge moyen pondéré par la note (les remplaçants pèsent peu).
function weightedAge(list: ReviewPlayer[]): number | null {
  const w = list.reduce((s, p) => s + Math.max(1, p.overall - 60), 0);
  if (list.length === 0 || w === 0) return null;
  return list.reduce((s, p) => s + p.age * Math.max(1, p.overall - 60), 0) / w;
}

export function verdictFor(ratio: number): TradeVerdict {
  if (ratio >= 1.3) return "big_gain";
  if (ratio >= 1.08) return "gain";
  if (ratio >= 0.92) return "even";
  if (ratio >= 0.75) return "loss";
  return "big_loss";
}

// Rapport de valeur « neutre » pour notre équipe (sans erreur
// d'appréciation) : sert au verdict de l'adjoint et à la réaction de la
// direction.
export function tradeValueRatio(params: {
  incoming: ReviewAsset[];
  outgoing: ReviewAsset[];
  outlook: TeamOutlook;
  picksPerRound: number;
  payrollBefore: number;
  taxLine: number;
}): number {
  const d = evaluateTradeForAi({
    outlook: params.outlook,
    received: params.incoming.map(asTradeAsset),
    given: params.outgoing.map(asTradeAsset),
    picksPerRound: params.picksPerRound,
    payrollBefore: params.payrollBefore,
    taxLine: params.taxLine,
  });
  if (d.given <= 0) return d.received > 0 ? 2 : 1;
  return Math.max(0, d.received) / d.given;
}

export function assistantTradeReview(params: {
  incoming: ReviewAsset[];
  outgoing: ReviewAsset[];
  outlook: TeamOutlook;
  picksPerRound: number;
  payrollBefore: number;
  taxLine: number;
  // Postes de notre effectif actuel (pour repérer un poste laissé vide).
  roster: { id: string; position: string; overall: number }[];
  skill: number; // 0-99
  seed?: string;
}): TradeReview {
  const s = Math.max(0, Math.min(99, params.skill)) / 99;
  const trueRatio = tradeValueRatio(params);
  const ratio = Math.max(0, trueRatio * (1 + seeded(params.seed ?? "") * (1 - s) * 0.25));
  const inP = players(params.incoming);
  const outP = players(params.outgoing);
  const salaryNet = salaryOf(params.incoming) - salaryOf(params.outgoing);
  const points: ReviewPoint[] = [];

  // Meilleur joueur de chaque côté.
  const bestIn = [...inP].sort((a, b) => b.overall - a.overall)[0];
  const bestOut = [...outP].sort((a, b) => b.overall - a.overall)[0];
  if (bestIn && (!bestOut || bestIn.overall >= bestOut.overall + 2)) points.push({ kind: "upgrade", name: bestIn.name, overall: bestIn.overall });
  else if (bestOut && (!bestIn || bestOut.overall >= bestIn.overall + 3)) points.push({ kind: "downgrade", name: bestOut.name, overall: bestOut.overall });

  // Côté choix de l'équipe en course au titre : céder un titulaire contre de
  // l'avenir affaiblit tout de suite.
  const starters = new Set([...params.roster].sort((a, b) => b.overall - a.overall).slice(0, 5).map((p) => p.id));
  if (params.outlook === "contender" && outP.some((p) => starters.has(p.id)) && (!bestIn || (bestOut && bestIn.overall < bestOut.overall))) {
    points.push({ kind: "weakensNow" });
  }

  // Âge.
  const ageIn = weightedAge(inP);
  const ageOut = weightedAge(outP);
  if (ageIn !== null && ageOut !== null) {
    const diff = Math.round(ageOut - ageIn);
    if (diff >= 3) points.push({ kind: "younger", years: diff });
    else if (diff <= -3) points.push({ kind: "older", years: -diff });
  }
  if (params.outlook === "rebuild") {
    const vet = inP.find((p) => p.age >= 30 && p.overall >= 72);
    if (vet) points.push({ kind: "veteranForRebuild", name: vet.name });
  }

  // Salaires.
  if (salaryNet <= -3_000_000) points.push({ kind: "salarySaved", amount: -salaryNet });
  else if (salaryNet >= 3_000_000) points.push({ kind: "salaryAdded", amount: salaryNet });
  if (params.payrollBefore <= params.taxLine && params.payrollBefore + salaryNet > params.taxLine) points.push({ kind: "taxCrossed" });

  // Contrats reçus.
  const bad = inP.find((p) => p.standard && p.yearsRemaining >= 3 && p.overall < 74 && p.salary >= 15_000_000);
  if (bad) points.push({ kind: "badContract", name: bad.name, years: bad.yearsRemaining });
  const expiring = inP.find((p) => p.yearsRemaining <= 1 && p.overall >= 78);
  if (expiring) points.push({ kind: "expiring", name: expiring.name });

  // Choix de draft.
  const picksIn = params.incoming.filter((a) => a.kind === "pick").length;
  const picksOut = params.outgoing.filter((a) => a.kind === "pick").length;
  if (picksIn > picksOut) points.push({ kind: "picksGained", count: picksIn - picksOut });
  else if (picksOut > picksIn) points.push({ kind: "picksLost", count: picksOut - picksIn });

  // Poste laissé sans titulaire possible.
  const outIds = new Set(outP.map((p) => p.id));
  const after = [...params.roster.filter((p) => !outIds.has(p.id)), ...inP];
  for (const p of outP) {
    if (!after.some((x) => x.position === p.position && x.overall >= 70)) {
      if (!points.some((x) => x.kind === "positionGap" && x.position === p.position)) points.push({ kind: "positionGap", position: p.position });
    }
  }

  // Les fans : un chouchou qui s'en va (un bon adjoint le voit venir).
  const fav = outP.find((p) => p.renown >= 75);
  if (fav && s >= 0.4) points.push({ kind: "fanFavourite", name: fav.name });

  // Un adjoint limité ne relève que l'essentiel.
  const maxPoints = 2 + Math.round(s * 4);
  return {
    verdict: verdictFor(ratio),
    ratio,
    confidence: s >= 0.7 ? "high" : s >= 0.45 ? "medium" : "low",
    points: points.slice(0, maxPoints),
    salaryNet,
  };
}

// ---------------------------------------------------------------------------
// Réactions à un échange conclu

export type FansMood = "thrilled" | "pleased" | "mixed" | "upset" | "furious";
export type BoardMood = "delighted" | "satisfied" | "neutral" | "concerned" | "angry";
export type BoardReason = "value" | "future" | "finances" | "tax" | "win_now";

export interface TradeReactions {
  fans: { mood: FansMood; delta: number; favourite: string | null; star: string | null };
  board: { mood: BoardMood; delta: number; reason: BoardReason };
}

// Les fans regardent les noms : un joueur connu (renommée) pèse plus que
// sa seule valeur sportive ; les choix de draft les touchent peu, sauf en
// reconstruction.
function fanValue(a: ReviewAsset, outlook: TeamOutlook, picksPerRound: number): number {
  if (a.kind === "pick") return pickTradeValue(a.round, a.pickNumber, picksPerRound) * (outlook === "rebuild" ? 0.6 : 0.3);
  return playerTradeValue(a.overall, a.age) * (0.6 + (Math.max(0, Math.min(99, a.renown)) / 99) * 0.8);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function tradeReactions(params: {
  incoming: ReviewAsset[];
  outgoing: ReviewAsset[];
  outlook: TeamOutlook;
  picksPerRound: number;
  payrollBefore: number;
  taxLine: number;
}): TradeReactions {
  const { outlook, picksPerRound } = params;
  const sum = (list: ReviewAsset[]) => list.reduce((s, a) => s + fanValue(a, outlook, picksPerRound), 0);
  const fin = sum(params.incoming);
  const fout = sum(params.outgoing);
  const fanRatio = fout <= 0 ? (fin > 0 ? 2 : 1) : fin / fout;
  const favourite = players(params.outgoing).filter((p) => p.renown >= 75).sort((a, b) => b.renown - a.renown)[0] ?? null;
  const star = players(params.incoming).filter((p) => p.renown >= 75 || p.overall >= 85).sort((a, b) => b.renown - a.renown)[0] ?? null;
  let fanDelta = clamp(Math.round((fanRatio - 1) * 10), -8, 8);
  if (favourite) fanDelta -= 3;
  if (star) fanDelta += 2;
  fanDelta = clamp(fanDelta, -10, 10);
  const fansMood: FansMood =
    fanDelta >= 6 ? "thrilled" : fanDelta >= 2 ? "pleased" : fanDelta > -2 ? "mixed" : fanDelta > -6 ? "upset" : "furious";

  const ratio = tradeValueRatio(params);
  const salaryNet = salaryOf(params.incoming) - salaryOf(params.outgoing);
  let boardDelta = clamp(Math.round((ratio - 1) * 8), -6, 6);
  let reason: BoardReason = "value";
  const crossesTax = params.payrollBefore <= params.taxLine && params.payrollBefore + salaryNet > params.taxLine;
  if (crossesTax) {
    boardDelta -= 2;
    reason = "tax";
  } else if (salaryNet <= -10_000_000) {
    boardDelta += 1;
    if (boardDelta >= 0) reason = "finances";
  }
  const picksIn = params.incoming.filter((a) => a.kind === "pick").length;
  if (reason === "value" && outlook === "rebuild" && picksIn > 0 && boardDelta >= 0) reason = "future";
  if (reason === "value" && outlook === "contender" && boardDelta > 0) reason = "win_now";
  boardDelta = clamp(boardDelta, -8, 6);
  const boardMood: BoardMood =
    boardDelta >= 4 ? "delighted" : boardDelta >= 1 ? "satisfied" : boardDelta > -2 ? "neutral" : boardDelta > -5 ? "concerned" : "angry";

  return {
    fans: { mood: fansMood, delta: fanDelta, favourite: favourite?.name ?? null, star: star?.name ?? null },
    board: { mood: boardMood, delta: boardDelta, reason },
  };
}

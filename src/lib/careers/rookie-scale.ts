interface Range {
  min: number;
  max: number;
}

// Barème rookie, déterministe par place de pick (contrairement à
// generate-contracts.ts qui tire un salaire aléatoire par overall pour les
// vétérans). Le 1er tour est garanti (comme un vrai contrat rookie NBA), le
// 2e tour ne l'est pas.
const ROOKIE_SCALE: Record<string, { round1: Range; round2: Range }> = {
  nba: {
    round1: { min: 3_000_000, max: 12_000_000 },
    round2: { min: 1_000_000, max: 2_200_000 },
  },
  wnba: {
    round1: { min: 70_000, max: 260_000 },
    round2: { min: 40_000, max: 70_000 },
  },
};

export interface RookieContractTerms {
  salary: number;
  yearsRemaining: number;
  guaranteed: boolean;
}

export function rookieScaleContract(
  pickNumber: number,
  picksPerRound: number,
  leagueId: string
): RookieContractTerms {
  const round = pickNumber <= picksPerRound ? 1 : 2;
  const positionInRound = round === 1 ? pickNumber : pickNumber - picksPerRound;
  const scale = ROOKIE_SCALE[leagueId] ?? ROOKIE_SCALE.nba;
  const range = round === 1 ? scale.round1 : scale.round2;
  const t = picksPerRound > 1 ? (positionInRound - 1) / (picksPerRound - 1) : 0;
  const salary = Math.round(range.max - t * (range.max - range.min));
  return {
    salary,
    yearsRemaining: round === 1 ? 3 : 2,
    guaranteed: round === 1,
  };
}

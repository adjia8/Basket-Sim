// Règles pures de contrats alternatifs (two-way NBA / développement WNBA) et
// de prolongation — aucun accès base de données ici, tout est piloté par
// src/app/actions/roster.ts.

export type ContractType = "standard" | "two_way" | "development";

// Type de contrat alternatif proposable selon la ligue — jamais les deux
// dans la même ligue (pas de "two-way" en WNBA dans ce modèle simplifié).
export const ALT_CONTRACT_TYPE: Record<string, ContractType> = {
  nba: "two_way",
  wnba: "development",
};

export const ALT_CONTRACT_LABEL: Record<ContractType, string> = {
  standard: "Standard",
  two_way: "Two-way",
  development: "Développement",
};

// Salaire fixe, largement sous le minimum standard — ces contrats n'entrent
// pas dans le plafond salarial (voir getPayrollForTeam) ni dans le roster
// standard de 5-10 joueurs (voir ALT_CONTRACT_SLOTS_PER_TEAM, roster-rules.ts).
export const ALT_CONTRACT_SALARY: Record<string, number> = {
  nba: 500_000,
  wnba: 75_000,
};

// Pas de notion d'"années d'expérience" dans ce modèle : l'âge sert
// d'approximation pour l'éligibilité (joueurs en développement/marginaux).
export const ALT_CONTRACT_AGE_LIMIT = 23;
export const ALT_CONTRACT_SLOTS_PER_TEAM = 2;

export function isEligibleForAlternateContract(age: number): boolean {
  return age <= ALT_CONTRACT_AGE_LIMIT;
}

// Fenêtre de prolongation simplifiée : seulement quand il reste peu d'années
// au contrat courant, pour éviter de prolonger en boucle sans jamais arriver
// à échéance.
export const EXTENSION_MAX_YEARS_REMAINING = 2;

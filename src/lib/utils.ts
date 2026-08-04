import type { Team } from "@/lib/types";

export function formatGameDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function teamFullName(team: Team): string {
  return `${team.city} ${team.name}`;
}

export function formatSalary(amount: number): string {
  // minimumFractionDigits égal à maximumFractionDigits : sans ça, l'affichage ou
  // non du ".0" en notation compacte n'est pas garanti identique entre le rendu
  // serveur (Node) et le navigateur, ce qui casse l'hydratation React.
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount);
}

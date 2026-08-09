import type { Team } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";

const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-US" };

export function formatGameDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function teamFullName(team: Team): string {
  return `${team.city} ${team.name}`;
}

export function formatSalary(amount: number, locale: Locale): string {
  // minimumFractionDigits égal à maximumFractionDigits : sans ça, l'affichage ou
  // non du ".0" en notation compacte n'est pas garanti identique entre le rendu
  // serveur (Node) et le navigateur, ce qui casse l'hydratation React.
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount);
}

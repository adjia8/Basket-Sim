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

// Suffixe ordinal pour un classement ("3e" / "3rd") — partagé entre l'aperçu
// de match et les questions de conférence de presse (press-rules.ts), qui
// affichent tous deux un rang de classement.
export function ordinalSuffix(rank: number, locale: Locale): string {
  if (locale === "fr") return rank === 1 ? "re" : "e";
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
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

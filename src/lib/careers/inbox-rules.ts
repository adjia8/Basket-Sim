// Règles pures de la boîte de réception du GM — pas d'accès base de données
// ici, tout est piloté par src/lib/data-access/inbox.ts et les générateurs
// de messages (press.ts, trade-requests.ts, injuries.ts, simulate.ts).
//
// Le texte de chaque message est généré ici en ternaires de locale, jamais
// via le dictionnaire i18n (t()) : même principe que press-rules.ts pour les
// prompts de conférence de presse — un message est écrit dans la langue de
// la requête qui l'a créé et reste figé tel quel en base, contrairement au
// texte statique de la page /inbox elle-même (label des boutons, titres de
// section), qui lui passe bien par src/lib/i18n/dict/inbox.ts.

import type { Locale } from "@/lib/i18n/locale";
import { formatSalary } from "@/lib/utils";

// Anti-spam pour les messages "agent libre notable disponible" — même
// principe que TEAM_TRADE_REQUEST_COOLDOWN_DAYS (player-demands.ts).
export const FREE_AGENT_NEWS_COOLDOWN_DAYS = 10;
// Seuil de renommé à partir duquel un agent libre est jugé assez notable
// pour justifier un message — aligné sur STAR_RENOWN_THRESHOLD
// (player-demands.ts), la même barre que pour les exigences d'équipe.
export const NOTABLE_FREE_AGENT_RENOWN_THRESHOLD = 70;

// Un changement de rang (dans un sens comme dans l'autre) mérite un message
// — previousRank null = jamais encore suivi pour cette Career (première
// vérification), pas un "changement" en soi.
export function conferenceRankChanged(previousRank: number | null, currentRank: number): boolean {
  return previousRank !== null && previousRank !== currentRank;
}

export interface InboxMessageText {
  title: string;
  body: string;
}

export function pressMessageText(locale: Locale): InboxMessageText {
  return locale === "fr"
    ? {
        title: "Les médias attendent une déclaration",
        body: "Une conférence de presse t'attend suite au dernier match — les journalistes veulent une réaction.",
      }
    : {
        title: "The media are waiting on a statement",
        body: "A press conference is waiting after the last game — reporters want your reaction.",
      };
}

export function tradeRequestMessageText(locale: Locale, playerName: string): InboxMessageText {
  return locale === "fr"
    ? {
        title: `${playerName} souhaite être transférée`,
        body: `L'agent de ${playerName} a fait savoir qu'elle n'est plus satisfaite de sa situation et souhaite un transfert.`,
      }
    : {
        title: `${playerName} wants a trade`,
        body: `${playerName}'s agent has let it be known she's unhappy with her situation and is requesting a trade.`,
      };
}

const SEVERITY_LABEL: Record<string, { fr: string; en: string }> = {
  minor: { fr: "légère", en: "minor" },
  moderate: { fr: "modérée", en: "moderate" },
  severe: { fr: "sévère", en: "severe" },
};

export function injuryMessageText(
  locale: Locale,
  playerName: string,
  severity: string,
  gamesRemaining: number
): InboxMessageText {
  const severityLabel = SEVERITY_LABEL[severity]?.[locale] ?? severity;
  return locale === "fr"
    ? {
        title: `${playerName} blessée`,
        body: `${playerName} s'est blessée (gravité ${severityLabel}) — indisponible pour environ ${gamesRemaining} match(s).`,
      }
    : {
        title: `${playerName} injured`,
        body: `${playerName} picked up a ${severityLabel} injury — expected to miss about ${gamesRemaining} game(s).`,
      };
}

export function standingsMessageText(
  locale: Locale,
  teamName: string,
  previousRank: number,
  currentRank: number
): InboxMessageText {
  const improved = currentRank < previousRank;
  return locale === "fr"
    ? {
        title: improved ? "Progression au classement" : "Recul au classement",
        body: `${teamName} passe de la ${previousRank}e à la ${currentRank}e place.`,
      }
    : {
        title: improved ? "Moving up the standings" : "Slipping in the standings",
        body: `${teamName} moved from ${previousRank}${ordinalSuffixEn(previousRank)} to ${currentRank}${ordinalSuffixEn(currentRank)} place.`,
      };
}

function ordinalSuffixEn(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  switch (n % 10) {
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

export function freeAgentMessageText(
  locale: Locale,
  playerName: string,
  position: string,
  expectedSalary: number
): InboxMessageText {
  const salary = formatSalary(expectedSalary, locale);
  return locale === "fr"
    ? {
        title: `Agent libre disponible : ${playerName}`,
        body: `L'agent de ${playerName} (${position}) signale sa disponibilité sur le marché — prétention salariale autour de ${salary}.`,
      }
    : {
        title: `Free agent available: ${playerName}`,
        body: `${playerName}'s (${position}) agent has flagged her availability on the market — asking around ${salary}.`,
      };
}

export function poachOfferMessageText(locale: Locale, teamName: string): InboxMessageText {
  return locale === "fr"
    ? {
        title: "Offre de dépeçage reçue",
        body: `${teamName} souhaite t'embaucher comme GM. Réponds depuis la page GM.`,
      }
    : {
        title: "Poaching offer received",
        body: `${teamName} wants to hire you as GM. Respond from the GM page.`,
      };
}

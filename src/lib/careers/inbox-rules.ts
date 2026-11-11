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

// Revue de presse publiée après une conférence : le gros titre retenu et le
// bilan des réactions.
export function pressReviewMessageText(
  locale: Locale,
  headline: string,
  totals: { morale: number; publicOpinion: number; frontOfficeApproval: number },
  skipped: boolean
): InboxMessageText {
  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "±0");
  if (locale === "fr") {
    return {
      title: `Revue de presse — ${headline}`,
      body: skipped
        ? `Ton adjoint a répondu aux journalistes à ta place. Opinion publique ${sign(totals.publicOpinion)}.`
        : `Tes déclarations font les gros titres. Moral de l'équipe ${sign(totals.morale)}, opinion publique ${sign(totals.publicOpinion)}, relation avec la direction ${sign(totals.frontOfficeApproval)}.`,
    };
  }
  return {
    title: `Press review — ${headline}`,
    body: skipped
      ? `Your assistant answered the reporters for you. Public opinion ${sign(totals.publicOpinion)}.`
      : `Your comments are making headlines. Team morale ${sign(totals.morale)}, public opinion ${sign(totals.publicOpinion)}, front office relationship ${sign(totals.frontOfficeApproval)}.`,
  };
}

// Réaction d'un joueur à ce que le GM a dit de lui en conférence de presse.
export function playerReactionMessageText(
  locale: Locale,
  playerName: string,
  positive: boolean,
  women = false
): InboxMessageText {
  if (locale === "fr") {
    return positive
      ? {
          title: `${playerName} apprécie ton soutien public`,
          body: `${playerName} a été ${women ? "touchée" : "touché"} par tes mots en conférence de presse. Son moral est en hausse.`,
        }
      : {
          title: `${playerName} n'a pas apprécié tes propos`,
          body: `${playerName} a mal vécu tes déclarations en conférence de presse. Son moral est en baisse — ${women ? "une joueuse malheureuse" : "un joueur malheureux"} finit par demander à partir.`,
        };
  }
  const his = women ? "Her" : "His";
  return positive
    ? {
        title: `${playerName} appreciates your public support`,
        body: `${playerName} was touched by what you said at the press conference. ${his} morale is up.`,
      }
    : {
        title: `${playerName} didn't like your comments`,
        body: `${playerName} took your press conference comments badly. ${his} morale is down — an unhappy player eventually asks to leave.`,
      };
}

// Staff : budget de la nouvelle saison alloué par les propriétaires.
export function staffSeasonBudgetMessageText(locale: Locale, budget: number, committed: number): InboxMessageText {
  const b = formatSalary(budget, locale);
  const c = formatSalary(committed, locale);
  return locale === "fr"
    ? {
        title: `Budget staff de la saison : ${b}`,
        body: `Les propriétaires t'allouent ${b} pour le staff cette saison. Salaires déjà engagés : ${c}. Pense à combler les postes vacants.`,
      }
    : {
        title: `Staff budget for the season: ${b}`,
        body: `Ownership has allocated ${b} for staff this season. Salaries already committed: ${c}. Remember to fill any vacancies.`,
      };
}

// Staff : départ (retraite ou fin de contrat non prolongé).
export function staffDepartureMessageText(locale: Locale, name: string, reason: "retired" | "contract"): InboxMessageText {
  if (locale === "fr") {
    return reason === "retired"
      ? { title: `${name} prend sa retraite`, body: `${name} quitte le staff pour prendre sa retraite. Le poste est vacant.` }
      : {
          title: `${name} quitte le staff`,
          body: `Le contrat de ${name} est arrivé à son terme sans prolongation. Le poste est vacant — recrute un remplaçant sur le marché.`,
        };
  }
  return reason === "retired"
    ? { title: `${name} retires`, body: `${name} is leaving the staff to retire. The position is vacant.` }
    : {
        title: `${name} leaves the staff`,
        body: `${name}'s contract expired without an extension. The position is vacant — hire a replacement on the market.`,
      };
}

// Staff : réponse des propriétaires à une demande de rallonge.
export function budgetRequestMessageText(locale: Locale, approved: boolean, budget: number): InboxMessageText {
  const b = formatSalary(budget, locale);
  if (locale === "fr") {
    return approved
      ? { title: "Rallonge accordée", body: `Les propriétaires acceptent d'augmenter le budget staff : il passe à ${b}.` }
      : { title: "Rallonge refusée", body: `Les propriétaires refusent d'augmenter le budget staff (${b}). Une meilleure relation avec la direction aiderait.` };
  }
  return approved
    ? { title: "Budget increase approved", body: `Ownership agrees to raise the staff budget to ${b}.` }
    : { title: "Budget increase denied", body: `Ownership declines to raise the staff budget (${b}). A better relationship with the front office would help.` };
}

// Offre d'échange à l'initiative d'une équipe IA.
export function aiTradeOfferMessageText(
  locale: Locale,
  teamName: string,
  target: string,
  assets: string[]
): InboxMessageText {
  const list = assets.join(", ");
  return locale === "fr"
    ? {
        title: `${teamName} veut ${target}`,
        body: `${teamName} propose un échange : ${list} contre ${target}. Réponds depuis la page Échanges.`,
      }
    : {
        title: `${teamName} want ${target}`,
        body: `${teamName} propose a trade: ${list} for ${target}. Respond from the Trades page.`,
      };
}

// Amende de la ligue pour critiques répétées de l'arbitrage.
export function refereeFineMessageText(locale: Locale, amount: number): InboxMessageText {
  const money = locale === "fr" ? `${amount.toLocaleString("fr-FR")} $` : `$${amount.toLocaleString("en-US")}`;
  return locale === "fr"
    ? {
        title: `Amende de la ligue : ${money}`,
        body: `La ligue t'inflige une amende de ${money} pour tes critiques répétées envers l'arbitrage. Elle est prélevée sur la trésorerie de la franchise.`,
      }
    : {
        title: `League fine: ${money}`,
        body: `The league has fined you ${money} for repeated criticism of the officiating. It's taken out of the franchise's finances.`,
      };
}

export function tradeRequestMessageText(locale: Locale, playerName: string): InboxMessageText {
  return locale === "fr"
    ? {
        title: `${playerName} demande un transfert`,
        body: `L'agent de ${playerName} fait savoir que la situation actuelle ne convient plus et réclame un transfert.`,
      }
    : {
        title: `${playerName} wants a trade`,
        body: `${playerName}'s agent says the current situation isn't working and is requesting a trade.`,
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
  gamesRemaining: number,
  injuryLabel?: string,
  returnLabel?: string
): InboxMessageText {
  const severityLabel = SEVERITY_LABEL[severity]?.[locale] ?? severity;
  const what = injuryLabel ?? (locale === "fr" ? `Blessure ${severityLabel}` : `A ${severityLabel} injury`);
  return locale === "fr"
    ? {
        title: `Blessure : ${playerName}`,
        body: `${what} (${severityLabel}) pour ${playerName} — indisponible pour environ ${gamesRemaining} match(s)${
          returnLabel ? `, retour estimé le ${returnLabel}` : ""
        }.`,
      }
    : {
        title: `${playerName} injured`,
        body: `${what} (${severityLabel}) for ${playerName} — expected to miss about ${gamesRemaining} game(s)${
          returnLabel ? `, estimated return ${returnLabel}` : ""
        }.`,
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
        body: `${playerName}'s (${position}) agent is shopping their client on the market — asking around ${salary}.`,
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

export function freeAgencyOpenMessageText(locale: Locale): InboxMessageText {
  return locale === "fr"
    ? {
        title: "La free agency est ouverte",
        body: "La draft est terminée : les agents libres peuvent signer. Les autres équipes commenceront à recruter dès que tu avanceras dans le calendrier.",
      }
    : {
        title: "Free agency is open",
        body: "The draft is over and free agents can now sign. Other teams will start recruiting as soon as you move the calendar forward.",
      };
}

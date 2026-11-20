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
import type { PlayerReaction, PressReactions } from "./press-reactions-rules";
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
  skipped: boolean,
  reactions?: PressReactions
): InboxMessageText {
  const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "±0");
  const fr = locale === "fr";
  const lines: string[] = [];
  if (skipped) {
    lines.push(fr ? `Ton adjoint a répondu aux journalistes à ta place. Opinion publique ${sign(totals.publicOpinion)}.` : `Your assistant answered the reporters for you. Public opinion ${sign(totals.publicOpinion)}.`);
  } else {
    lines.push(
      fr
        ? `Tes déclarations font les gros titres. Moral de l'équipe ${sign(totals.morale)}, opinion publique ${sign(totals.publicOpinion)}, relation avec la direction ${sign(totals.frontOfficeApproval)}.`
        : `Your comments are making headlines. Team morale ${sign(totals.morale)}, public opinion ${sign(totals.publicOpinion)}, front office relationship ${sign(totals.frontOfficeApproval)}.`
    );
  }
  if (reactions) {
    if (reactions.media.length > 0) {
      lines.push("", fr ? "Dans la presse :" : "In the press:");
      for (const m of reactions.media) lines.push(`• ${m.outlet} — ${m.headline}`);
    }
    if (reactions.mediaReputation) {
      const rep = {
        closed: fr ? "Les journalistes te trouvent fermé : trop de langue de bois au fil des conférences (opinion publique -2)." : "Reporters find you guarded: too much stonewalling over recent pressers (public opinion -2).",
        fiery: fr ? "Ta réputation de coach sulfureux grandit : chaque conférence fait le buzz." : "Your fiery reputation is growing: every presser makes noise.",
        respected: fr ? "La presse salue ta constance et ta franchise (opinion publique +1)." : "The press praises your consistency and candor (public opinion +1).",
      }[reactions.mediaReputation];
      lines.push(rep);
    }
    if (reactions.fans.length > 0) {
      lines.push("", fr ? "Sur les réseaux :" : "On social media:");
      for (const f of reactions.fans) lines.push(`${f.handle} : « ${f.text} »`);
      if (reactions.fanMood !== 0) {
        lines.push(
          reactions.fanMood > 0
            ? fr ? `Les fans ont aimé : affluence ${sign(reactions.fanMood)}.` : `Fans loved it: attendance ${sign(reactions.fanMood)}.`
            : fr ? `Les fans grincent des dents : affluence ${sign(reactions.fanMood)}.` : `Fans aren't happy: attendance ${sign(reactions.fanMood)}.`
        );
      }
    }
  }
  return { title: `${fr ? "Revue de presse" : "Press review"} — ${headline}`, body: lines.join("\n") };
}

// Réaction d'un joueur à ce que le GM a dit (de lui ou du groupe) en
// conférence de presse, selon sa personnalité (voir press-reactions-rules.ts).
export function playerPressReactionMessageText(locale: Locale, r: PlayerReaction, women = false): InboxMessageText {
  const fr = locale === "fr";
  const e = (m: string, f: string) => (women ? f : m);
  const titles: Record<PlayerReaction["kind"], [string, string]> = {
    grateful: [`${r.name} apprécie ton soutien public`, `${r.name} appreciates your public support`],
    fired_up: [`${r.name}, ${e("galvanisé", "galvanisée")} par tes mots`, `${r.name} is fired up by your words`],
    public_reply: [`${r.name} te répond dans les médias`, `${r.name} fires back in the media`],
    takes_it_well: [`${r.name} accepte la critique`, `${r.name} takes the criticism on board`],
    wants_meeting: [`${r.name} a mal vécu tes propos`, `${r.name} took your comments badly`],
    leader_backs_coach: [`${r.name} soutient ton discours`, `${r.name} backs your message`],
    leader_defends_group: [`${r.name} prend la défense du vestiaire`, `${r.name} stands up for the locker room`],
    leader_thanks: [`${r.name} salue ton soutien au groupe`, `${r.name} thanks you for backing the group`],
  };
  const notes: Record<PlayerReaction["kind"], [string, string]> = {
    grateful: ["Son moral est en hausse.", "Morale is up."],
    fired_up: ["Son moral grimpe, et l'ambition avec.", "Morale is up, and ambition with it."],
    public_reply: [
      "Sa réponse publique fait du bruit dans le vestiaire et dans la presse. Il demande à te voir.",
      "The public reply is making noise in the locker room and the press. A meeting has been requested.",
    ],
    takes_it_well: ["En vrai professionnel, il en fait une motivation : le vestiaire apprécie.", "A true professional, using it as motivation — the locker room appreciates it."],
    wants_meeting: ["Son moral baisse et il demande à te parler.", "Morale is down and a meeting has been requested."],
    leader_backs_coach: ["Le leader du vestiaire relaie ton message : le groupe suit.", "The locker-room leader relays your message: the group follows."],
    leader_defends_group: ["Le leader du vestiaire n'a pas aimé que tu t'en prennes au groupe.", "The locker-room leader didn't like you going after the group."],
    leader_thanks: ["Le vestiaire se sent soutenu.", "The locker room feels backed."],
  };
  const [titleFr, titleEn] = titles[r.kind];
  const [noteFr, noteEn] = notes[r.kind];
  const note = fr ? (women ? noteFr.replace(/\bIl\b/g, "Elle").replace(/\bil\b/g, "elle") : noteFr) : noteEn;
  return { title: fr ? titleFr : titleEn, body: `« ${r.quote} »\n\n${note}` };
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

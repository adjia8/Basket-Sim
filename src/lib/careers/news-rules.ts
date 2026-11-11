// Textes de l'actualité de la ligue et des notifications de trophées — même
// principe que inbox-rules.ts : écrits dans la langue de la requête qui les
// crée et figés en base. Accord selon la ligue (WNBA : joueuses).

import type { Locale } from "@/lib/i18n/locale";
import type { AwardType } from "./awards-rules";

export interface NewsText {
  title: string;
  body: string;
}

const AWARD_NAMES: Record<AwardType, { fr: string; frWomen: string; en: string }> = {
  mvp: { fr: "MVP de la saison", frWomen: "MVP de la saison", en: "Season MVP" },
  dpoy: { fr: "Défenseur de l'année", frWomen: "Défenseuse de l'année", en: "Defensive Player of the Year" },
  roy: { fr: "Rookie de l'année", frWomen: "Rookie de l'année", en: "Rookie of the Year" },
  sixth_man: { fr: "Sixième homme de l'année", frWomen: "Sixième femme de l'année", en: "Sixth Man of the Year" },
  mip: { fr: "Meilleure progression", frWomen: "Meilleure progression", en: "Most Improved Player" },
  coach: { fr: "Entraîneur de l'année", frWomen: "Entraîneur de l'année", en: "Coach of the Year" },
  all_nba_1: { fr: "1re équipe All-NBA", frWomen: "1re équipe All-WNBA", en: "All-NBA First Team" },
  all_nba_2: { fr: "2e équipe All-NBA", frWomen: "2e équipe All-WNBA", en: "All-NBA Second Team" },
  all_nba_3: { fr: "3e équipe All-NBA", frWomen: "3e équipe All-WNBA", en: "All-NBA Third Team" },
  all_star: { fr: "All-Star", frWomen: "All-Star", en: "All-Star" },
};

export function awardName(type: AwardType, locale: Locale, women = false): string {
  const n = AWARD_NAMES[type];
  return locale === "fr" ? (women ? n.frWomen : n.fr) : n.en;
}

export function awardNews(
  locale: Locale,
  type: AwardType,
  winner: string,
  teamName: string,
  line: string | null,
  runnersUp: string[],
  women = false
): NewsText {
  const award = awardName(type, locale, women);
  if (locale === "fr") {
    return {
      title: `${winner} (${teamName}) élu${women && type !== "coach" ? "e" : ""} ${award}`,
      body: [line ? `Sa saison : ${line}.` : null, runnersUp.length ? `Sur le podium : ${runnersUp.join(", ")}.` : null]
        .filter(Boolean)
        .join(" "),
    };
  }
  return {
    title: `${winner} (${teamName}) named ${award}`,
    body: [line ? `Season line: ${line}.` : null, runnersUp.length ? `Also in the running: ${runnersUp.join(", ")}.` : null]
      .filter(Boolean)
      .join(" "),
  };
}

export function allLeagueNews(locale: Locale, teams: { type: AwardType; names: string[] }[], women = false): NewsText {
  const lines = teams.map((t) => `${awardName(t.type, locale, women)} : ${t.names.join(", ")}`);
  return locale === "fr"
    ? { title: women ? "Les équipes All-WNBA dévoilées" : "Les équipes All-NBA dévoilées", body: lines.join(". ") + "." }
    : { title: women ? "All-WNBA teams announced" : "All-NBA teams announced", body: lines.join(". ") + "." };
}

export function allStarNews(locale: Locale, groups: { label: string; names: string[] }[]): NewsText {
  const body = groups.map((g) => `${g.label} : ${g.names.join(", ")}`).join(". ") + ".";
  return locale === "fr"
    ? { title: "Les All-Stars de la saison sont connus", body }
    : { title: "This season's All-Stars are in", body };
}

export function performanceNews(
  locale: Locale,
  name: string,
  teamName: string,
  opponent: string,
  line: { points: number; rebounds: number; assists: number },
  tripleDouble: boolean,
  women = false
): NewsText {
  if (locale === "fr") {
    return tripleDouble && line.points < 40
      ? {
          title: `Triple-double pour ${name}`,
          body: `${name} (${teamName}) ${women ? "a signé" : "a signé"} ${line.points} points, ${line.rebounds} rebonds et ${line.assists} passes face à ${opponent}.`,
        }
      : {
          title: `${name} explose avec ${line.points} points`,
          body: `Soirée exceptionnelle pour ${name} (${teamName}) : ${line.points} points, ${line.rebounds} rebonds et ${line.assists} passes face à ${opponent}.`,
        };
  }
  return tripleDouble && line.points < 40
    ? {
        title: `Triple-double for ${name}`,
        body: `${name} (${teamName}) put up ${line.points} points, ${line.rebounds} rebounds and ${line.assists} assists against ${opponent}.`,
      }
    : {
        title: `${name} erupts for ${line.points} points`,
        body: `Huge night for ${name} (${teamName}): ${line.points} points, ${line.rebounds} rebounds and ${line.assists} assists against ${opponent}.`,
      };
}

export function starInjuryNews(locale: Locale, name: string, teamName: string, injury: string, games: number, women = false): NewsText {
  return locale === "fr"
    ? {
        title: `Coup dur pour ${teamName} : ${name} ${women ? "blessée" : "blessé"}`,
        body: `${name} souffre d'une ${injury.toLowerCase()} et devrait manquer environ ${games} matchs.`,
      }
    : {
        title: `Blow for the ${teamName}: ${name} injured`,
        body: `${name} has a ${injury.toLowerCase()} and is expected to miss about ${games} games.`,
      };
}

export function streakNews(locale: Locale, teamName: string, count: number, winning: boolean): NewsText {
  if (locale === "fr") {
    return winning
      ? { title: `${teamName} : ${count} victoires de suite`, body: `${teamName} enchaîne et signe une série de ${count} victoires consécutives.` }
      : { title: `${teamName} : ${count} défaites de suite`, body: `Rien ne va plus pour ${teamName}, qui s'incline pour la ${count}e fois d'affilée.` };
  }
  return winning
    ? { title: `${teamName}: ${count} straight wins`, body: `${teamName} keep rolling with ${count} consecutive wins.` }
    : { title: `${teamName}: ${count} straight losses`, body: `Things are going wrong for ${teamName}, who have now lost ${count} in a row.` };
}

export function awardInboxText(locale: Locale, name: string, award: string, women = false): NewsText {
  return locale === "fr"
    ? {
        title: `${name} : ${award}`,
        body: `Bonne nouvelle : ${name} reçoit la distinction « ${award} ». Sa renommée et son moral sont en hausse.`,
      }
    : {
        title: `${name}: ${award}`,
        body: `Good news: ${name} receives the "${award}" honor. ${women ? "Her" : "His"} renown and morale are up.`,
      };
}

export function tradeNews(locale: Locale, teamA: string, teamB: string, aGets: string[], bGets: string[]): NewsText {
  // Pas de double point quand la liste finit par « Jr. ».
  const list = (l: string[]) => (l.length ? l.join(", ") : "—").replace(/\.$/, "");
  return locale === "fr"
    ? {
        title: `Échange entre ${teamA} et ${teamB}`,
        body: `${teamA} reçoit ${list(aGets)}. ${teamB} reçoit ${list(bGets)}.`,
      }
    : {
        title: `Trade between the ${teamA} and the ${teamB}`,
        body: `The ${teamA} receive ${list(aGets)}. The ${teamB} receive ${list(bGets)}.`,
      };
}

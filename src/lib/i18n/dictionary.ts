import * as common from "./dict/common";
import * as domain from "./dict/domain";
import * as roster from "./dict/roster";
import * as team from "./dict/team";
import * as tradeOffers from "./dict/tradeOffers";
import * as rosterActions from "./dict/rosterActions";
import * as auth from "./dict/auth";
import * as onboarding from "./dict/onboarding";
import * as dashboard from "./dict/dashboard";
import * as game from "./dict/game";
import * as schedule from "./dict/schedule";
import * as gm from "./dict/gm";
import * as freeAgents from "./dict/freeAgents";
import * as draft from "./dict/draft";
import * as seasonRecap from "./dict/seasonRecap";
import * as press from "./dict/press";
import * as staff from "./dict/staff";
import * as tactics from "./dict/tactics";
import * as talks from "./dict/talks";
import * as league from "./dict/league";
import * as leaguePages from "./dict/leaguePages";
import * as promise from "./dict/promise";
import * as rotation from "./dict/rotation";
import * as inbox from "./dict/inbox";
import * as negotiation from "./dict/negotiation";
import * as cup from "./dict/cup";
import * as careers from "./dict/careers";
import * as personality from "./dict/personality";
import * as scout from "./dict/scout";
import * as status from "./dict/status";
import * as progress from "./dict/progress";
import * as board from "./dict/board";
import * as live from "./dict/live";
import * as help from "./dict/help";
import * as futureDraft from "./dict/futureDraft";
import * as playerTalk from "./dict/playerTalk";
import * as interview from "./dict/interview";
import * as calendar from "./dict/calendar";
import * as protocol from "./dict/protocol";
import * as loadplan from "./dict/loadplan";
import * as finance from "./dict/finance";
import * as injuries from "./dict/injuries";
import * as report from "./dict/report";
import * as tradeReview from "./dict/tradeReview";
import * as facility from "./dict/facility";
import * as gmCareer from "./dict/gmCareer";

// Chaque module dict/<zone>.ts exporte { fr, en } avec les MÊMES clés (voir
// common.ts pour le patron : un tableau `keys as const`, puis deux
// `Record<Key, string>`). Ajouter un nouveau module = l'importer ici, puis
// l'ajouter au spread ci-dessous ET au tableau `sources` (pour le contrôle
// anti-doublon) — le spread statique (plutôt qu'un Object.assign dynamique)
// est ce qui permet à TypeScript d'inférer l'union exacte des clés valides.
const sources = [
  common,
  domain,
  roster,
  team,
  tradeOffers,
  rosterActions,
  auth,
  onboarding,
  dashboard,
  game,
  schedule,
  gm,
  freeAgents,
  draft,
  seasonRecap,
  press,
  staff,
  tactics,
  talks,
  league,
  leaguePages,
  promise,
  rotation,
  inbox,
  negotiation,
  cup,
  careers,
  personality,
  scout,
  status,
  progress,
  board,
  live,
  help,
  futureDraft,
  playerTalk,
  interview,
  calendar,
  protocol,
  loadplan,
  finance,
  injuries,
  report,
  tradeReview,
  facility,
  gmCareer,
];

export const dictionaries = {
  fr: {
    ...common.fr,
    ...domain.fr,
    ...roster.fr,
    ...team.fr,
    ...tradeOffers.fr,
    ...rosterActions.fr,
    ...auth.fr,
    ...onboarding.fr,
    ...dashboard.fr,
    ...game.fr,
    ...schedule.fr,
    ...gm.fr,
    ...freeAgents.fr,
    ...draft.fr,
    ...seasonRecap.fr,
    ...press.fr,
    ...staff.fr,
    ...tactics.fr,
    ...talks.fr,
    ...league.fr,
    ...leaguePages.fr,
    ...promise.fr,
    ...rotation.fr,
    ...inbox.fr,
    ...negotiation.fr,
    ...cup.fr,
    ...careers.fr,
    ...personality.fr,
    ...scout.fr,
    ...status.fr,
    ...progress.fr,
    ...board.fr,
    ...live.fr,
    ...help.fr,
    ...futureDraft.fr,
    ...playerTalk.fr,
    ...interview.fr,
    ...calendar.fr,
    ...protocol.fr,
    ...loadplan.fr,
    ...finance.fr,
    ...injuries.fr,
    ...report.fr,
    ...tradeReview.fr,
    ...facility.fr,
    ...gmCareer.fr,
  },
  en: {
    ...common.en,
    ...domain.en,
    ...roster.en,
    ...team.en,
    ...tradeOffers.en,
    ...rosterActions.en,
    ...auth.en,
    ...onboarding.en,
    ...dashboard.en,
    ...game.en,
    ...schedule.en,
    ...gm.en,
    ...freeAgents.en,
    ...draft.en,
    ...seasonRecap.en,
    ...press.en,
    ...staff.en,
    ...tactics.en,
    ...talks.en,
    ...league.en,
    ...leaguePages.en,
    ...promise.en,
    ...rotation.en,
    ...inbox.en,
    ...negotiation.en,
    ...cup.en,
    ...careers.en,
    ...personality.en,
    ...scout.en,
    ...status.en,
    ...progress.en,
    ...board.en,
    ...live.en,
    ...help.en,
    ...futureDraft.en,
    ...playerTalk.en,
    ...interview.en,
    ...calendar.en,
    ...protocol.en,
    ...loadplan.en,
    ...finance.en,
    ...injuries.en,
    ...report.en,
    ...tradeReview.en,
    ...facility.en,
    ...gmCareer.en,
  },
};

export type DictionaryKey = keyof typeof dictionaries.fr;

// Filet de sécurité : deux modules qui déclarent la même clé par erreur
// s'écraseraient silencieusement au spread ci-dessus — on le détecte tout de
// suite (échec net au chargement) plutôt que de laisser une traduction
// disparaître silencieusement dans une des deux langues.
(function assertNoDuplicateKeys() {
  const seen = new Set<string>();
  for (const source of sources) {
    for (const key of Object.keys(source.fr)) {
      if (seen.has(key)) {
        throw new Error(`Clé de dictionnaire i18n dupliquée : "${key}"`);
      }
      seen.add(key);
    }
  }
})();

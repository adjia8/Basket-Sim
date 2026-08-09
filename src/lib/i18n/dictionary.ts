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
import * as leaguePages from "./dict/leaguePages";

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
  leaguePages,
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
    ...leaguePages.fr,
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
    ...leaguePages.en,
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

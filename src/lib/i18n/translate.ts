import "server-only";
import { dictionaries, type DictionaryKey } from "./dictionary";
import { getLocale, type Locale } from "./locale";

export type Translator = (key: DictionaryKey, vars?: Record<string, string | number>) => string;

// Substitution simple {nom} — pas besoin d'un moteur i18n complet pour un
// nombre de variables toujours petit et connu à l'appel.
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

export function translatorFor(locale: Locale): Translator {
  const dict = dictionaries[locale];
  return (key, vars) => interpolate(dict[key], vars);
}

// Point d'entrée standard dans une Server Component / Server Action : lit la
// locale depuis le cookie puis renvoie le traducteur assorti.
export async function getTranslator(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale();
  return { t: translatorFor(locale), locale };
}

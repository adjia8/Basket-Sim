import "server-only";
import { cookies } from "next/headers";

export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : DEFAULT_LOCALE;
}

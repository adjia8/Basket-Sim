"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";

// Pas de vérification de session : la langue n'est pas une donnée de
// gameplay, un visiteur non connecté (login/register) doit pouvoir la
// changer aussi.
export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get("locale") === "en" ? "en" : "fr";
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  // Toute la page (layout inclus) est rendue selon la locale côté serveur —
  // contrairement au thème (pur CSS client), il faut revalider pour que le
  // texte déjà rendu se retraduise.
  revalidatePath("/", "layout");
}

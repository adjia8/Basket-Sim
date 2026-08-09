import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n/locale";

// Pas de "use client" : un simple <form action> server-driven suffit (même
// esprit que les autres formulaires-boutons de l'app, ex: setPlayingThroughInjury).
export function LanguageToggle({ locale, label }: { locale: Locale; label: string }) {
  const next: Locale = locale === "fr" ? "en" : "fr";
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={next} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="text-sm text-black/50 transition hover:text-black dark:text-white/50 dark:hover:text-white"
      >
        {locale === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
      </button>
    </form>
  );
}

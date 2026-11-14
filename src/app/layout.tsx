import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/layout/NavBar";
import { GameTopBar } from "@/components/layout/GameTopBar";
import { getLocale } from "@/lib/i18n/locale";
import { getThemeContext } from "@/lib/theme/theme-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Le bouton « Continuer » de la barre du haut (Server Action continueGame,
// lots de ~15 s) est présent sur toutes les pages : plafond relevé pour
// toutes, plutôt que page par page.
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Hoops Manager",
  description: "Simulation de gestion NBA/WNBA façon Football Manager",
};

// Appliqué avant l'hydratation pour éviter un flash du mauvais thème :
// respecte le choix explicite de l'utilisateur (localStorage) s'il existe,
// sinon thème sombre (ambiance "bureau de GM" par défaut).
// Même principe pour l'accent « couleurs de ma franchise » (voir
// TeamAccentToggle.tsx) : désactivé par défaut.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("team-accent", localStorage.getItem("teamAccent") === "1");
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, theme] = await Promise.all([getLocale(), getThemeContext()]);
  return (
    <html
      lang={locale}
      data-phase={theme.phase}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Accent aux couleurs de l'équipe (actif seulement avec .team-accent). */}
        {theme.teamAccentCss && <style dangerouslySetInnerHTML={{ __html: theme.teamAccentCss }} />}
      </head>
      <body className="min-h-full">
        <NavBar />
        <main className="min-w-0 pb-12">
          <GameTopBar />
          {children}
        </main>
      </body>
    </html>
  );
}

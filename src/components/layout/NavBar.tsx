import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getOptionalCurrentMembership } from "@/lib/auth/dal";
import { getTeamById } from "@/lib/data-access/teams";
import { getPendingPressConference } from "@/lib/data-access/press";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { NavDropdown } from "./NavDropdown";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import { getTranslator } from "@/lib/i18n/translate";

export async function NavBar() {
  const membership = await getOptionalCurrentMembership();
  const team = membership ? await getTeamById(membership.teamId) : null;
  const { t, locale } = await getTranslator();

  // Signaux "attention requise" — les items concernés (Presse/GM sous
  // "Club", Échanges sous "Transactions") sont maintenant cachés derrière
  // un clic sur le menu déroulant : un point rouge restaure la visibilité
  // "en un coup d'œil" qu'avait la nav à plat.
  const [pendingPress, pendingTradeCount, gmProfile] = membership
    ? await Promise.all([
        getPendingPressConference(membership.careerId, membership.teamId),
        prisma.tradeOffer.count({
          where: { careerId: membership.careerId, toTeamId: membership.teamId, status: "pending" },
        }),
        prisma.gmProfile.findUnique({
          where: { membershipId: membership.id },
          select: { pendingOfferTeamId: true },
        }),
      ])
    : [null, 0, null];
  const hasPendingPress = pendingPress !== null;
  const hasPendingTrade = pendingTradeCount > 0;
  const hasPendingPoach = Boolean(gmProfile?.pendingOfferTeamId);

  // Liens autonomes : les pages les plus consultées, en accès direct.
  // Le reste est regroupé par thème (ligue / transactions / club) pour ne
  // pas aligner 12 onglets à plat dans la barre.
  const NAV_LINKS = [
    { href: "/", label: t("common.nav.dashboard") },
    ...(membership ? [{ href: `/teams/${membership.teamId}`, label: t("common.nav.myTeam") }] : []),
    { href: "/teams", label: t("common.nav.teams") },
    { href: "/schedule", label: t("common.nav.schedule") },
  ];

  const NAV_GROUPS = [
    {
      label: t("common.nav.groupLeague"),
      items: [
        { href: "/standings", label: t("common.nav.standings") },
        { href: "/playoffs", label: t("common.nav.playoffs") },
        { href: "/season-recap", label: t("common.nav.recap") },
      ],
    },
    {
      label: t("common.nav.groupTransactions"),
      items: [
        { href: "/free-agents", label: t("common.nav.freeAgents") },
        { href: "/draft", label: t("common.nav.draft") },
        { href: "/trades", label: t("common.nav.trades"), alert: hasPendingTrade },
      ],
    },
    {
      label: t("common.nav.groupClub"),
      items: [
        { href: "/franchise", label: t("common.nav.franchise") },
        { href: "/gm", label: t("common.nav.gm"), alert: hasPendingPoach },
        { href: "/press", label: t("common.nav.press"), alert: hasPendingPress },
      ],
    },
  ];

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          🏀 Hoops Manager
          {team && (
            <TeamColorSwatch primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} />
          )}
        </Link>

        {membership && (
          <nav className="flex items-center gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.label} label={group.label} items={group.items} />
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          <LanguageToggle locale={locale} label={t("common.languageToggle.label")} />
          <ThemeToggle toLightLabel={t("common.themeToggle.toLight")} toDarkLabel={t("common.themeToggle.toDark")} />
          {membership ? (
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
              >
                {t("common.logout")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
            >
              {t("common.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getOptionalCurrentMembership } from "@/lib/auth/dal";
import { getTeamById } from "@/lib/data-access/teams";
import { getPendingPressConference } from "@/lib/data-access/press";
import { getUnreadInboxCount } from "@/lib/data-access/inbox";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { SidebarNav, type NavSection } from "./SidebarNav";
import { getTranslator } from "@/lib/i18n/translate";

export async function NavBar() {
  const membership = await getOptionalCurrentMembership();
  const team = membership ? await getTeamById(membership.teamId) : null;
  const { t, locale } = await getTranslator();

  // Signaux "attention requise" — les items concernés (Presse/GM sous
  // "Club", Échanges sous "Transactions") sont maintenant cachés derrière
  // un clic sur le menu déroulant : un point rouge restaure la visibilité
  // "en un coup d'œil" qu'avait la nav à plat.
  const [pendingPress, pendingTradeCount, gmProfile, unreadInboxCount] = membership
    ? await Promise.all([
        getPendingPressConference(membership.careerId, membership.teamId),
        prisma.tradeOffer.count({
          where: { careerId: membership.careerId, toTeamId: membership.teamId, status: "pending" },
        }),
        prisma.gmProfile.findUnique({
          where: { membershipId: membership.id },
          select: { pendingOfferTeamId: true },
        }),
        getUnreadInboxCount(membership.careerId, membership.teamId),
      ])
    : [null, 0, null, 0];
  const hasPendingPress = pendingPress !== null;
  const hasPendingTrade = pendingTradeCount > 0;
  const hasPendingPoach = Boolean(gmProfile?.pendingOfferTeamId);

  // Sections de la barre latérale : le bureau (pages les plus consultées)
  // puis les regroupements thématiques, tous visibles d'un coup d'œil — la
  // place verticale de la barre latérale permet de se passer des menus
  // déroulants de l'ancienne barre horizontale. La boîte de réception est
  // transversale (presse/agents/blessures/classement...), donc dans le bureau.
  const sections: NavSection[] = [
    {
      label: t("common.nav.groupMain"),
      items: [
        { href: "/", label: t("common.nav.dashboard") },
        ...(membership ? [{ href: "/inbox", label: t("common.nav.inbox"), badge: unreadInboxCount }] : []),
        ...(membership ? [{ href: `/teams/${membership.teamId}`, label: t("common.nav.myTeam") }] : []),
        { href: "/schedule", label: t("common.nav.schedule") },
        { href: "/teams", label: t("common.nav.teams") },
      ],
    },
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
        { href: "/staff", label: t("common.nav.staff") },
        { href: "/gm", label: t("common.nav.gm"), alert: hasPendingPoach },
        { href: "/press", label: t("common.nav.press"), alert: hasPendingPress },
      ],
    },
  ];

  const brand = (
    <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm" aria-hidden>
        🏀
      </span>
      Hoops Manager
    </Link>
  );

  const toggles = (
    <div className="flex items-center gap-3">
      <LanguageToggle locale={locale} label={t("common.languageToggle.label")} />
      <ThemeToggle toLightLabel={t("common.themeToggle.toLight")} toDarkLabel={t("common.themeToggle.toDark")} />
    </div>
  );

  // Visiteur non connecté : simple barre du haut (connexion/inscription,
  // onboarding) — la barre latérale n'a de sens qu'avec une carrière.
  if (!membership) {
    return (
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {brand}
          <div className="flex items-center gap-4">
            {toggles}
            <Link href="/login" className="text-sm text-muted underline-offset-2 hover:text-fg hover:underline">
              {t("common.login")}
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const teamBlock = team && (
    <Link
      href={`/teams/${team.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 transition hover:border-line-strong"
    >
      <span
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: `linear-gradient(${team.primaryColor} 50%, ${team.secondaryColor} 50%)` }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{team.city}</span>
        <span className="block truncate text-sm font-semibold">{team.name}</span>
      </span>
    </Link>
  );

  return (
    <SidebarNav
      brand={brand}
      team={teamBlock}
      sections={sections}
      menuLabel={t("common.nav.menu")}
      footer={
        <div className="flex items-center justify-between gap-3">
          {toggles}
          <form action={logout}>
            <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              {t("common.logout")}
            </button>
          </form>
        </div>
      }
    />
  );
}

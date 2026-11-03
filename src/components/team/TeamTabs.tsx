import Link from "next/link";

// Onglets de la page d'équipe, pilotés par l'URL (?tab=...) : un onglet se
// partage/se recharge tel quel et le bouton « retour » du navigateur
// fonctionne, sans état client.
export function TeamTabs({
  baseHref,
  active,
  tabs,
}: {
  baseHref: string;
  active: string;
  tabs: { id: string; label: string }[];
}) {
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.id === tabs[0].id ? baseHref : `${baseHref}?tab=${tab.id}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

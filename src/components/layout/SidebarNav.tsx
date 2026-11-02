"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  // Compteur (non lus) ou simple point d'alerte (action en attente :
  // conférence de presse, offre de trade reçue, offre de braconnage GM).
  badge?: number;
  alert?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Un seul lien actif : le plus spécifique (ex. /teams/lal → "Mon équipe"
// plutôt que "Équipes", qui correspond aussi par préfixe).
function activeHref(pathname: string, sections: NavSection[]): string | undefined {
  return sections
    .flatMap((s) => s.items.map((i) => i.href))
    .filter((href) => matches(pathname, href))
    .sort((a, b) => b.length - a.length)[0];
}

// Composant client : ne gère que l'état actif (pathname) et l'ouverture du
// tiroir mobile — les libellés, compteurs et boutons du pied (langue,
// thème, déconnexion) arrivent déjà prêts depuis NavBar.tsx.
export function SidebarNav({
  brand,
  team,
  sections,
  footer,
  menuLabel,
}: {
  brand: ReactNode;
  team: ReactNode;
  sections: NavSection[];
  footer: ReactNode;
  menuLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Le menu mobile se referme à chaque navigation (même principe que la
  // remise à zéro d'état sur changement de prop recommandée par React).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }
  const current = activeHref(pathname, sections);
  const hasAlert = sections.some((s) => s.items.some((i) => i.alert || (i.badge ?? 0) > 0));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label && <p className="eyebrow mb-1.5 px-2">{section.label}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm transition ${
                      active
                        ? "border-accent bg-surface-2 font-medium text-fg"
                        : "border-transparent text-soft hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                    {(item.badge ?? 0) > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg tabular">
                        {(item.badge ?? 0) > 9 ? "9+" : item.badge}
                      </span>
                    )}
                    {item.alert && <span className="h-2 w-2 shrink-0 rounded-full bg-bad" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile / tablette : barre du haut + tiroir */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {brand}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={menuLabel}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line text-soft hover:bg-surface-2"
          >
            <span aria-hidden className="text-lg leading-none">{open ? "✕" : "☰"}</span>
            {hasAlert && !open && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-bad" aria-hidden />}
          </button>
        </div>
        {open && (
          <div className="flex max-h-[calc(100dvh-61px)] flex-col border-t border-line">
            <div className="px-4 pt-3">{team}</div>
            {nav}
            <div className="border-t border-line px-4 py-3">{footer}</div>
          </div>
        )}
      </header>

      {/* Bureau : barre latérale fixe */}
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-4">{brand}</div>
        <div className="px-3 pt-4">{team}</div>
        {nav}
        <div className="border-t border-line px-5 py-3">{footer}</div>
      </aside>
    </>
  );
}

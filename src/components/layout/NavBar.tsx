import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getOptionalCurrentMembership } from "@/lib/auth/dal";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/teams", label: "Équipes" },
  { href: "/schedule", label: "Calendrier" },
  { href: "/standings", label: "Classement" },
  { href: "/free-agents", label: "Agents libres" },
  { href: "/draft", label: "Draft" },
  { href: "/trades", label: "Échanges" },
  { href: "/playoffs", label: "Playoffs" },
];

export async function NavBar() {
  const membership = await getOptionalCurrentMembership();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          🏀 Hoops Manager
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
          </nav>
        )}

        {membership ? (
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
            >
              Se déconnecter
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="text-sm text-black/50 underline-offset-2 hover:underline dark:text-white/50"
          >
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}

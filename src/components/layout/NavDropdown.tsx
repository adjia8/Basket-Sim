"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function AlertDot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />;
}

// Composant client : ne gère que l'ouverture/fermeture, les libellés
// arrivent déjà traduits depuis NavBar.tsx (Server Component). `alert` sur
// un item signale qu'une action attend (conférence de presse en attente,
// offre de trade reçue, offre de braconnage GM) — vu que ces pages sont
// maintenant cachées derrière un clic, sans ce point rouge elles seraient
// plus faciles à oublier qu'avec l'ancienne nav à plat.
export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; alert?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasAlert = items.some((item) => item.alert);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
      >
        {label}
        {hasAlert && <AlertDot />}
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 min-w-40 rounded-lg border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {item.label}
              {item.alert && <AlertDot />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

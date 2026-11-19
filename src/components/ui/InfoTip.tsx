"use client";

import { useId, useState } from "react";

// Aide en jeu : un petit « ? » à côté d'une notion.
// - Ordinateur : l'explication s'affiche au survol ou au focus clavier.
// - Mobile (dont iPhone/iPad, où un toucher ne déclenche ni survol ni focus
//   sur un bouton) : un toucher l'ouvre, un second ou un clic ailleurs la
//   referme ; elle s'affiche alors en bandeau calé dans l'écran.
// Fermée, elle est retirée de l'affichage (display: none) : elle ne crée
// jamais de défilement horizontal, même près du bord droit.
export function InfoTip({ text, label = "?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="group relative ml-1 inline-flex align-middle normal-case tracking-normal">
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold leading-none text-muted transition hover:border-accent hover:text-accent-text focus-visible:border-accent"
      >
        {label}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`${open ? "block" : "hidden"} fixed inset-x-4 bottom-4 z-50 rounded-md border border-line bg-surface-3 px-3 py-2 text-left text-xs font-normal leading-snug text-fg shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-full sm:mt-1.5 sm:w-64 sm:-translate-x-1/2 sm:group-focus-within:block sm:group-hover:block`}
      >
        {text}
      </span>
    </span>
  );
}

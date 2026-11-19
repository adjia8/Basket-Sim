// Aide en jeu : un petit « ? » à côté d'une notion, qui affiche son
// explication au survol, au focus clavier, ou au toucher sur mobile (le
// bouton prend le focus). Pur CSS, utilisable dans les Server Components.
export function InfoTip({ text, label = "?" }: { text: string; label?: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle normal-case tracking-normal">
      <button
        type="button"
        aria-label={text}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold leading-none text-muted transition hover:border-accent hover:text-accent-text focus-visible:border-accent"
      >
        {label}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-md border border-line bg-surface-3 px-3 py-2 text-left text-xs font-normal leading-snug text-fg opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

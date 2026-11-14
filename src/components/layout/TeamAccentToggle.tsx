"use client";

import { useSyncExternalStore } from "react";

// Accent « couleurs de ma franchise » : préférence locale au navigateur,
// comme le thème clair/sombre (voir ThemeToggle.tsx et le script anti-flash
// de layout.tsx). La feuille de style correspondante est injectée par
// layout.tsx et ne s'applique qu'avec la classe .team-accent sur <html>.
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("team-accent");
}

function getServerSnapshot(): boolean {
  return false;
}

function setTeamAccent(on: boolean): void {
  document.documentElement.classList.toggle("team-accent", on);
  try {
    localStorage.setItem("teamAccent", on ? "1" : "0");
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la page.
  }
  listeners.forEach((listener) => listener());
}

export function TeamAccentToggle({
  onLabel,
  offLabel,
  primaryColor,
  secondaryColor,
}: {
  onLabel: string;
  offLabel: string;
  primaryColor: string;
  secondaryColor: string;
}) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = active ? offLabel : onLabel;
  return (
    <button
      type="button"
      onClick={() => setTeamAccent(!active)}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
        active ? "border-accent" : "border-line-strong opacity-70 hover:opacity-100"
      }`}
    >
      <span
        aria-hidden
        className="h-3 w-3 rounded-full"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)` }}
      />
    </button>
  );
}

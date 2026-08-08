"use client";

import { useSyncExternalStore } from "react";

// Le thème est un état externe (classe DOM + localStorage), pas un état React
// — useSyncExternalStore est l'outil prévu pour ça (contrairement à un
// useEffect + setState, qui provoquerait un rendu en cascade évitable et
// gère mal la synchronisation initiale serveur/client).
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

// Rendu serveur : toujours clair par défaut, corrigé dès l'hydratation par
// useSyncExternalStore lui-même (voir le script anti-flash de layout.tsx
// pour la classe réellement appliquée avant le premier paint).
function getServerSnapshot(): boolean {
  return false;
}

function setTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(!isDark)}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      className="text-sm text-black/50 transition hover:text-black dark:text-white/50 dark:hover:text-white"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

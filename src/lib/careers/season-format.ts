// "2025-2026" -> "2026-2027" (NBA) ; "2026" -> "2027" (WNBA)
export function nextSeasonLabel(season: string): string {
  const parts = season.split("-");
  if (parts.length === 2 && parts.every((p) => /^\d{4}$/.test(p))) {
    return `${Number(parts[0]) + 1}-${Number(parts[1]) + 1}`;
  }
  if (/^\d{4}$/.test(season)) {
    return String(Number(season) + 1);
  }
  throw new Error(`Format de saison inattendu: "${season}"`);
}

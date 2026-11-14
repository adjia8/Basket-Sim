// Accent « couleurs de ma franchise » (façon skin de club dans Football
// Manager) — règles pures, sans accès base de données.
//
// On part de la couleur principale de l'équipe, ou de la secondaire si la
// principale est trop terne ou trop proche du fond (violet des Lakers sur
// bleu nuit → l'or). La teinte est gardée, seule la luminosité est ajustée
// pour atteindre le contraste voulu sur la surface du thème. Une équipe aux
// couleurs uniquement noir/blanc/gris (Nets, Spurs) garde l'accent du thème.

export interface AccentTokens {
  accent: string;
  accentHover: string;
  accentFg: string;
  accentText: string;
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6 : max === gn ? ((bn - rn) / d + 2) / 6 : ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255];
}

// Même teinte, luminosité poussée (vers le clair sur fond sombre, vers le
// foncé sur fond clair) jusqu'au contraste visé.
function adjustToContrast(hex: string, surface: string, target: number, darkSurface: boolean): string {
  const rgb = hexToRgb(hex)!;
  const [h, s, l0] = rgbToHsl(rgb);
  let l = l0;
  let out = hex;
  for (let i = 0; i < 60 && contrast(out, surface) < target; i++) {
    l = darkSurface ? Math.min(1, l + 0.015) : Math.max(0, l - 0.015);
    out = rgbToHex(hslToRgb([h, s, l]));
  }
  return out;
}

function saturation(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb)[1] : 0;
}

function shift(hex: string, amount: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex)!);
  return rgbToHex(hslToRgb([h, s, Math.max(0, Math.min(1, l + amount))]));
}

const MIN_SATURATION = 0.2; // en dessous : noir, blanc, gris, argent
const UI_CONTRAST = 3; // boutons, élément actif (WCAG : composants)
const TEXT_CONTRAST = 4.5; // texte d'accent (WCAG AA)

export function teamAccent(
  primaryColor: string,
  secondaryColor: string,
  surface: string,
  darkSurface: boolean
): AccentTokens | null {
  const candidates = [primaryColor, secondaryColor].filter(
    (c) => hexToRgb(c) && saturation(c) >= MIN_SATURATION
  );
  if (candidates.length === 0) return null;
  // La principale si elle tient déjà sur ce fond, sinon la secondaire si
  // elle tient, sinon la principale ajustée.
  const fits = candidates.find((c) => contrast(c, surface) >= UI_CONTRAST);
  const base = fits ?? candidates[0];
  const accent = fits ? base : adjustToContrast(base, surface, UI_CONTRAST, darkSurface);
  const accentFg = contrast(accent, "#0b0b0f") >= contrast(accent, "#ffffff") ? "#0b0b0f" : "#ffffff";
  return {
    accent,
    accentHover: shift(accent, darkSurface ? 0.06 : -0.06),
    accentFg,
    accentText: adjustToContrast(accent, surface, TEXT_CONTRAST, darkSurface),
  };
}

// Surfaces des thèmes (voir globals.css) : Arena Night en saison, Trophée
// pendant les playoffs.
export const THEME_SURFACES = {
  regular: { light: "#ffffff", dark: "#0e1528" },
  playoffs: { light: "#ffffff", dark: "#15130f" },
} as const;

function block(selector: string, t: AccentTokens): string {
  return `${selector}{--accent:${t.accent};--accent-hover:${t.accentHover};--accent-fg:${t.accentFg};--accent-text:${t.accentText}}`;
}

// Feuille de style injectée dans <head> : ne s'applique que si la classe
// .team-accent est posée sur <html> (choix mémorisé dans le navigateur).
// Sélecteurs doublés pour passer devant les thèmes de globals.css quel que
// soit l'ordre des feuilles.
export function teamAccentCss(primaryColor: string, secondaryColor: string, phase: "regular" | "playoffs"): string | null {
  const surfaces = THEME_SURFACES[phase];
  const light = teamAccent(primaryColor, secondaryColor, surfaces.light, false);
  const dark = teamAccent(primaryColor, secondaryColor, surfaces.dark, true);
  if (!light || !dark) return null;
  return (
    block("html.team-accent.team-accent", light) +
    block("html.dark.team-accent.team-accent", dark)
  );
}

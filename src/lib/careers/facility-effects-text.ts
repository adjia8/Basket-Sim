import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import type { ProjectEffects, ProjectTier } from "./facility-projects-rules";

// Effets d'un palier en texte (carte de projet, message de livraison).
export function tierEffectLines(tier: Pick<ProjectTier, "effects" | "level" | "opinion">, t: Translator, locale: Locale): string[] {
  const pct = (v: number) => `${Math.round(v * 100)}`;
  const num = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 });
  const lines: string[] = [];
  const e: ProjectEffects = tier.effects;
  if (e.recovery) lines.push(t("facility.effect.recovery", { pct: pct(e.recovery) }));
  if (e.medical) lines.push(t("facility.effect.medical", { n: e.medical }));
  if (e.development) lines.push(t("facility.effect.development", { n: e.development }));
  if (e.tactical) lines.push(t("facility.effect.tactical", { n: num(e.tactical) }));
  if (e.homeCourt) lines.push(t("facility.effect.homeCourt", { n: num(e.homeCourt) }));
  if (e.fill) lines.push(t("facility.effect.fill", { pct: pct(e.fill) }));
  if (e.premium) lines.push(t("facility.effect.premium", { pct: pct(e.premium) }));
  if (e.concessions) lines.push(t("facility.effect.concessions", { pct: pct(e.concessions) }));
  if (e.merch) lines.push(t("facility.effect.merch", { pct: pct(e.merch) }));
  if (e.sponsors) lines.push(t("facility.effect.sponsors", { pct: pct(e.sponsors) }));
  if (tier.opinion) lines.push(t("facility.effect.opinion", { n: tier.opinion > 0 ? `+${tier.opinion}` : `${tier.opinion}` }));
  lines.push(t("facility.effect.level", { n: tier.level }));
  return lines;
}

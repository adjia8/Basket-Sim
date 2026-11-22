import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTranslator } from "@/lib/i18n/translate";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { formatSalary } from "@/lib/utils";
import {
  LIFESTYLE_ITEMS,
  lifestyleLevel,
  parseLifestyle,
  prestigeOf,
  RESALE_SHARE,
  type LifestyleCategory,
} from "@/lib/careers/gm-career-rules";
import { LifestyleItemCard } from "@/components/gm/LifestyleItemCard";

// Train de vie du GM : dépenser son salaire (logement, voitures, garde-robe…).
export default async function LifestylePage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();
  const gm = await prisma.gmProfile.findUnique({ where: { membershipId: membership.id } });
  if (!gm) notFound();
  const owned = parseLifestyle(gm.lifestyleJson);
  const prestige = prestigeOf(owned);
  const money = (v: number) => formatSalary(v, locale);
  const categories: LifestyleCategory[] = ["housing", "car", "wardrobe", "extra"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/gm" className="text-sm text-accent-text hover:underline">
        {t("lifestyle.back")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("lifestyle.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("lifestyle.intro")}</p>

      <div className="mt-4 card flex flex-wrap items-end justify-between gap-3 p-4" data-testid="lifestyle-summary">
        <div>
          <p className="text-xs text-muted">{t("lifestyle.cash")}</p>
          <p className="text-2xl font-semibold tabular text-good">{money(gm.personalCash)}</p>
        </div>
        <p className="text-sm text-soft">
          {t("lifestyle.level", { level: t(`gmCareer.lifestyle.${lifestyleLevel(prestige)}` as DictionaryKey), prestige })}
        </p>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="mt-6">
          <h2 className="text-lg font-semibold">{t(`lifestyle.category.${cat}` as DictionaryKey)}</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIFESTYLE_ITEMS.filter((i) => i.category === cat).map((i) => (
              <LifestyleItemCard
                key={i.key}
                item={{
                  key: i.key,
                  name: t(`lifestyle.item.${i.key}` as DictionaryKey),
                  price: money(i.price),
                  prestige: t("lifestyle.prestige", { n: i.prestige }),
                  fans: i.fans ? t("lifestyle.fans", { n: i.fans }) : null,
                  owned: owned.includes(i.key),
                  // Logement / garde-robe : l'ancien est revendu au passage.
                  affordable:
                    gm.personalCash +
                      (i.category === "housing" || i.category === "wardrobe"
                        ? owned
                            .map((k) => LIFESTYLE_ITEMS.find((x) => x.key === k)!)
                            .filter((x) => x.category === i.category)
                            .reduce((s, x) => s + Math.round(x.price * RESALE_SHARE), 0)
                        : 0) >=
                    i.price,
                }}
                labels={{
                  buy: t("lifestyle.buy"),
                  sell: t("lifestyle.sell", { amount: money(Math.round(i.price * RESALE_SHARE)) }),
                  owned: t("lifestyle.owned"),
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagues } from "@/lib/data-access/leagues";
import {
  getFranchiseSummariesForCareer,
  getFranchiseSummariesForNewCareer,
} from "@/lib/data-access/franchise-summary";
import { CareerForm } from "@/components/onboarding/CareerForm";
import { JoinByCodeForm } from "@/components/onboarding/JoinByCodeForm";
import { JoinCareerForm } from "@/components/onboarding/JoinCareerForm";
import { getTranslator } from "@/lib/i18n/translate";
import { franchiseCarouselLabels } from "@/lib/i18n/franchise-carousel-labels";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { userId } = await verifySession();
  const existing = await prisma.membership.findUnique({ where: { userId } });
  if (existing) redirect("/");

  const { t, locale } = await getTranslator();
  const { code } = await searchParams;
  const inviteCode = code?.trim().toUpperCase();

  if (inviteCode) {
    const career = await prisma.career.findUnique({ where: { inviteCode } });

    if (!career) {
      return (
        <div className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-2xl font-bold">{t("onboarding.invalidCodeTitle")}</h1>
          <p className="mt-2 text-black/60 dark:text-white/60">
            {t("onboarding.invalidCodeBody", { code: inviteCode })}
          </p>
          <Link href="/onboarding" className="mt-6 inline-block text-sm underline underline-offset-2">
            ← {t("common.back")}
          </Link>
        </div>
      );
    }

    const slides = await getFranchiseSummariesForCareer(career.id, career.leagueId, false);

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("onboarding.joinLeagueTitle")}</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">{t("onboarding.joinLeagueSubtitle")}</p>
        <div className="mt-8">
          <JoinCareerForm
            inviteCode={inviteCode}
            slides={slides}
            locale={locale}
            labels={franchiseCarouselLabels(t)}
          />
        </div>
      </div>
    );
  }

  const leagues = await getLeagues();
  const summariesByLeague = Object.fromEntries(
    await Promise.all(
      leagues.map(async (league) => [league.id, await getFranchiseSummariesForNewCareer(league.id)] as const)
    )
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{t("onboarding.chooseTeamTitle")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">{t("onboarding.chooseTeamSubtitle")}</p>
      <div className="mt-8">
        <CareerForm
          leagues={leagues}
          summariesByLeague={summariesByLeague}
          locale={locale}
          labels={franchiseCarouselLabels(t)}
        />
      </div>

      <div className="mt-12 border-t border-black/10 pt-8 dark:border-white/10">
        <h2 className="text-lg font-semibold">{t("onboarding.orJoinExisting")}</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">{t("onboarding.orJoinExistingSubtitle")}</p>
        <div className="mt-4">
          <JoinByCodeForm placeholder={t("onboarding.joinByCodePlaceholder")} button={t("onboarding.joinButton")} />
        </div>
      </div>
    </div>
  );
}

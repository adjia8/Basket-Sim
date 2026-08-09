import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getFranchiseSummariesForCareer } from "@/lib/data-access/franchise-summary";
import { getTeamById } from "@/lib/data-access/teams";
import { FranchiseCarousel } from "@/components/onboarding/FranchiseCarousel";
import { reassignFranchise } from "@/app/actions/gm";
import { getTranslator } from "@/lib/i18n/translate";
import { franchiseCarouselLabels } from "@/lib/i18n/franchise-carousel-labels";
import { teamFullName } from "@/lib/utils";

// Ne passe volontairement pas par getCurrentMembership() : celle-ci redirige
// déjà ici quand GmProfile.pendingReassignment est vrai, ce qui créerait une
// boucle de redirection si cette page l'appelait aussi.
export default async function ReassignFranchisePage() {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { career: true, gmProfile: true },
  });
  if (!membership?.gmProfile?.pendingReassignment) redirect("/");

  const { t, locale } = await getTranslator();
  const [slides, oldTeam] = await Promise.all([
    getFranchiseSummariesForCareer(membership.careerId, membership.career.leagueId, true),
    getTeamById(membership.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{t("onboarding.reassignTitle")}</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        {t("onboarding.reassignBody", {
          team: oldTeam ? teamFullName(oldTeam) : t("onboarding.formerTeamFallback"),
        })}
      </p>
      <div className="mt-8">
        <FranchiseCarousel
          slides={slides}
          mode="reassign"
          action={reassignFranchise}
          locale={locale}
          labels={franchiseCarouselLabels(t)}
        />
      </div>
    </div>
  );
}

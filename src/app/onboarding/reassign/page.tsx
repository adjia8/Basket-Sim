import { activeMembershipWhere } from "@/lib/auth/active-membership";
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
import { interestedTeams } from "@/lib/careers/gm-career-rules";

// Ne passe volontairement pas par getCurrentMembership() : celle-ci redirige
// déjà ici quand GmProfile.pendingReassignment est vrai, ce qui créerait une
// boucle de redirection si cette page l'appelait aussi.
export default async function ReassignFranchisePage() {
  const { userId } = await verifySession();
  const membership = await prisma.membership.findFirst({
    where: await activeMembershipWhere(userId),
    include: { career: true, gmProfile: true },
  });
  if (!membership?.gmProfile?.pendingReassignment) redirect("/");

  const { t, locale } = await getTranslator();
  const [allSlides, oldTeam] = await Promise.all([
    getFranchiseSummariesForCareer(membership.careerId, membership.career.leagueId, true),
    getTeamById(membership.teamId),
  ]);
  // Seuls les clubs intéressés par ce GM, selon sa réputation (voir
  // interestedTeams) ; l'ancien club ne le reprend pas.
  const reputation = membership.gmProfile.reputation;
  const interested = new Set(
    interestedTeams(
      allSlides.filter((s) => s.team.id !== membership.teamId).map((s) => ({ id: s.team.id, marketAppeal: s.team.marketAppeal })),
      reputation
    ).map((t) => t.id)
  );
  const slides = allSlides.filter((s) => interested.has(s.team.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.reassignTitle")}</h1>
      <p className="mt-1 text-soft">
        {t("onboarding.reassignBody", {
          team: oldTeam ? teamFullName(oldTeam) : t("onboarding.formerTeamFallback"),
        })}
      </p>
      <p className="mt-2 text-sm text-muted" data-testid="job-market">
        {t("gmCareer.jobMarket", { reputation, count: slides.length })}
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

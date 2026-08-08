import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getFranchiseSummariesForCareer } from "@/lib/data-access/franchise-summary";
import { getTeamById } from "@/lib/data-access/teams";
import { FranchiseCarousel } from "@/components/onboarding/FranchiseCarousel";
import { reassignFranchise } from "@/app/actions/gm";
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

  const [slides, oldTeam] = await Promise.all([
    getFranchiseSummariesForCareer(membership.careerId, membership.career.leagueId, true),
    getTeamById(membership.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tu as été licencié</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        La direction de {oldTeam ? teamFullName(oldTeam) : "ton ancienne équipe"} n&apos;a pas
        été satisfaite de ton bilan. Choisis une nouvelle franchise à gérer dans la même ligue.
      </p>
      <div className="mt-8">
        <FranchiseCarousel slides={slides} mode="reassign" action={reassignFranchise} />
      </div>
    </div>
  );
}

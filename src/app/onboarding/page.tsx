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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { userId } = await verifySession();
  const existing = await prisma.membership.findUnique({ where: { userId } });
  if (existing) redirect("/");

  const { code } = await searchParams;
  const inviteCode = code?.trim().toUpperCase();

  if (inviteCode) {
    const career = await prisma.career.findUnique({ where: { inviteCode } });

    if (!career) {
      return (
        <div className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-2xl font-bold">Code invalide</h1>
          <p className="mt-2 text-black/60 dark:text-white/60">
            Aucune ligue ne correspond au code « {inviteCode} ».
          </p>
          <Link href="/onboarding" className="mt-6 inline-block text-sm underline underline-offset-2">
            ← Retour
          </Link>
        </div>
      );
    }

    const slides = await getFranchiseSummariesForCareer(career.id, career.leagueId, false);

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold">Rejoindre la ligue</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Choisis une franchise encore disponible, puis crée ton GM.
        </p>
        <div className="mt-8">
          <JoinCareerForm inviteCode={inviteCode} slides={slides} />
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
      <h1 className="text-2xl font-bold">Quelle équipe veux-tu gérer ?</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Choisis une ligue puis une franchise, découvre ses finances/effectif/
        objectifs, puis crée ton GM. Ta carrière commence immédiatement.
      </p>
      <div className="mt-8">
        <CareerForm leagues={leagues} summariesByLeague={summariesByLeague} />
      </div>

      <div className="mt-12 border-t border-black/10 pt-8 dark:border-white/10">
        <h2 className="text-lg font-semibold">Ou rejoindre une ligue existante</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Un autre manager t&apos;a partagé un code d&apos;invitation ?
        </p>
        <div className="mt-4">
          <JoinByCodeForm />
        </div>
      </div>
    </div>
  );
}

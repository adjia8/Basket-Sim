import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagues } from "@/lib/data-access/leagues";
import { getAllTeams, getTeamsByLeague } from "@/lib/data-access/teams";
import { getMembershipsForCareer } from "@/lib/data-access/memberships";
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

    const [teams, managers] = await Promise.all([
      getTeamsByLeague(career.leagueId),
      getMembershipsForCareer(career.id),
    ]);

    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Rejoindre la ligue</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Choisis une franchise encore disponible.
        </p>
        <div className="mt-8">
          <JoinCareerForm inviteCode={inviteCode} teams={teams} managers={managers} />
        </div>
      </div>
    );
  }

  const [leagues, teams] = await Promise.all([getLeagues(), getAllTeams()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Quelle équipe veux-tu gérer ?</h1>
      <p className="mt-1 text-black/60 dark:text-white/60">
        Choisis une ligue puis une franchise. Ta carrière commence
        immédiatement.
      </p>
      <div className="mt-8">
        <CareerForm leagues={leagues} teams={teams} />
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

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getLeagues } from "@/lib/data-access/leagues";
import { getAllTeams } from "@/lib/data-access/teams";
import { CareerForm } from "@/components/onboarding/CareerForm";

export default async function OnboardingPage() {
  const { userId } = await verifySession();
  const existing = await prisma.career.findUnique({ where: { userId } });
  if (existing) redirect("/");

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
    </div>
  );
}

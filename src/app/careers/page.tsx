import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { MAX_CAREERS_PER_USER, getActiveMembershipId } from "@/lib/auth/active-membership";
import { switchCareer } from "@/app/actions/career";
import { DeleteCareerButton } from "@/components/dashboard/DeleteCareerButton";
import { TeamColorSwatch } from "@/components/team/TeamColorSwatch";
import { getTranslator } from "@/lib/i18n/translate";
import { formatGameDate } from "@/lib/utils";

// Liste des carrières (sauvegardes) du compte. Volontairement hors de
// getCurrentMembership : la page doit rester accessible même si la carrière
// active attend une conférence de presse ou une réaffectation.
export default async function CareersPage() {
  const { userId } = await verifySession();
  const { t, locale } = await getTranslator();
  const [memberships, activeId] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      include: {
        career: { include: { league: true, _count: { select: { memberships: true } } } },
        team: true,
        gmProfile: { select: { firstName: true, lastName: true } },
      },
    }),
    getActiveMembershipId(userId),
  ]);

  // Bilan de saison régulière et dernier match joué, par carrière.
  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const games = await prisma.game.findMany({
        where: {
          careerId: m.careerId,
          season: m.career.season,
          status: "final",
          OR: [{ homeTeamId: m.teamId }, { awayTeamId: m.teamId }],
        },
        select: { homeTeamId: true, homeScore: true, awayScore: true },
      });
      const wins = games.filter((g) =>
        g.homeTeamId === m.teamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0)
      ).length;
      const last = await prisma.game.findFirst({
        where: { careerId: m.careerId, status: "final" },
        orderBy: { gameDate: "desc" },
        select: { gameDate: true },
      });
      return { wins, losses: games.length - wins, lastPlayed: last?.gameDate ?? null };
    })
  );
  const atLimit = memberships.length >= MAX_CAREERS_PER_USER;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("careers.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("careers.subtitle")}</p>
        </div>
        {atLimit ? (
          <p className="text-sm text-muted">{t("careers.limit", { max: MAX_CAREERS_PER_USER })}</p>
        ) : (
          <Link
            href="/onboarding"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            + {t("careers.new")}
          </Link>
        )}
      </div>

      <ul className="mt-6 space-y-3">
        {memberships.map((m, i) => {
          const active = m.id === activeId;
          const s = summaries[i];
          return (
            <li key={m.id} className={`card p-4 ${active ? "border-accent" : ""}`} data-testid="career-row">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <TeamColorSwatch primaryColor={m.team.primaryColor} secondaryColor={m.team.secondaryColor} size="lg" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {m.team.city} {m.team.name}
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs font-medium uppercase text-soft">
                        {m.career.leagueId.toUpperCase()}
                      </span>
                      {active && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent-text">
                          {t("careers.active")}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {t("careers.season", { season: m.career.season })} ·{" "}
                      {t("careers.record", { wins: s.wins, losses: s.losses })}
                      {m.gmProfile && <> · {t("careers.gm", { name: `${m.gmProfile.firstName} ${m.gmProfile.lastName}` })}</>}
                    </p>
                    <p className="text-xs text-faint">
                      {s.lastPlayed
                        ? t("careers.lastPlayed", { date: formatGameDate(s.lastPlayed.toISOString(), locale) })
                        : t("careers.notStarted")}
                      {m.career._count.memberships > 1 && (
                        <> · {t("careers.shared", { count: m.career._count.memberships - 1 })}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <form action={switchCareer}>
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button
                      type="submit"
                      className={
                        active
                          ? "rounded-md border border-line px-4 py-1.5 text-sm font-medium hover:bg-surface-2"
                          : "rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                      }
                    >
                      {t("careers.resume")}
                    </button>
                  </form>
                  <DeleteCareerButton
                    membershipId={m.id}
                    labels={{
                      button: t("dashboard.deleteCareer"),
                      confirmMessage: t("dashboard.deleteCareerConfirm"),
                      confirmButton: t("dashboard.deleteCareerConfirmButton"),
                      cancelButton: t("dashboard.deleteCareerCancel"),
                      deleting: t("dashboard.deletingCareer"),
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import type { Translator } from "@/lib/i18n/translate";

// Choix de draft de mon équipe pour les drafts à venir : nombre de choix par
// draft, choix propres, choix récupérés (via une autre équipe) et choix cédés.
export async function MyDraftPicks({
  careerId,
  teamId,
  season,
  t,
}: {
  careerId: string;
  teamId: string;
  season: string; // saison en cours : ses choix comptent tant que la draft n'a pas eu lieu
  t: Translator;
}) {
  const picks = await prisma.draftPick.findMany({
    where: {
      careerId,
      status: "pending",
      season: { gte: season },
      OR: [{ teamId }, { originalTeamId: teamId }],
    },
    include: {
      originalTeam: { select: { abbreviation: true } },
      team: { select: { abbreviation: true } },
    },
    orderBy: [{ season: "asc" }, { round: "asc" }],
  });
  if (picks.length === 0) return null;

  const seasons = [...new Set(picks.map((p) => p.season))];
  return (
    <section className="mt-6" data-testid="my-draft-picks">
      <h2 className="eyebrow mb-3">{t("draft.myPicks.title")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {seasons.map((s) => {
          const own = picks.filter((p) => p.season === s && p.teamId === teamId);
          const traded = picks.filter((p) => p.season === s && p.teamId !== teamId);
          return (
            <div key={s} className="card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{t("draft.myPicks.draftYear", { year: s.slice(0, 4) })}</p>
                <p className={`text-2xl font-bold tabular ${own.length === 0 ? "text-bad" : ""}`}>{own.length}</p>
              </div>
              <p className="text-xs text-muted">{t("draft.myPicks.count", { count: own.length })}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {own.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>
                      {t(p.round === 1 ? "draft.myPicks.round1" : "draft.myPicks.round2")}
                      {p.pickNumber !== null && <span className="ml-1 text-xs text-muted">#{p.pickNumber}</span>}
                    </span>
                    {p.originalTeamId !== teamId && (
                      <span className="rounded bg-good/10 px-1.5 py-0.5 text-2xs font-semibold text-good">
                        {t("draft.myPicks.via", { team: p.originalTeam.abbreviation })}
                      </span>
                    )}
                  </li>
                ))}
                {traded.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-faint">
                    <span className="line-through">{t(p.round === 1 ? "draft.myPicks.round1" : "draft.myPicks.round2")}</span>
                    <span className="text-2xs">{t("draft.myPicks.tradedTo", { team: p.team.abbreviation })}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

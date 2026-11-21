import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { getStaffProfiles } from "@/lib/data-access/staff";
import { NEUTRAL_STAFF_PROFILE } from "@/lib/careers/staff-rules";
import { estimateRating, ratingStars } from "@/lib/careers/potential-rules";
import { NBA_REAL_PROSPECTS } from "@/lib/mock-data/real-prospects-nba";
import { Stars } from "@/components/ui/Stars";
import { InfoTip } from "@/components/ui/InfoTip";
import { getTranslator } from "@/lib/i18n/translate";

// Prospects des prochaines drafts (vrais joueurs universitaires, européens
// et lycéens, voir real-prospects-nba.ts), visibles 2 à 3 ans à l'avance.
// La note est une projection au moment de la draft, floutée selon le niveau
// des recruteurs — et d'autant plus que la draft est lointaine.
export default async function FutureDraftPage() {
  const m = await getCurrentMembership();
  const { t } = await getTranslator();
  const scouting =
    (await getStaffProfiles(m.careerId, [m.teamId], m.leagueId)).get(m.teamId)?.scouting ?? NEUTRAL_STAFF_PROFILE.scouting;
  const currentYear = Number(m.season.slice(0, 4));
  // Classes encore à venir : la draft de l'intersaison prochaine et les
  // suivantes (clé "AAAA-AAAA" = draft de juin AAAA).
  const classes =
    m.leagueId === "nba"
      ? Object.entries(NBA_REAL_PROSPECTS)
          .map(([key, list]) => ({ year: Number(key.slice(0, 4)), key, list }))
          .filter((c) => c.year > currentYear)
          .sort((a, b) => a.year - b.year)
          .slice(0, 3)
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/draft" className="text-sm text-accent-text hover:underline">
        ← {t("draft.title")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {t("futureDraft.title")}
        <InfoTip text={t("futureDraft.help")} />
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t("futureDraft.subtitle", { scouting })}</p>

      {classes.length === 0 ? (
        <p className="mt-6 card p-4 text-sm text-muted">{t("futureDraft.none")}</p>
      ) : (
        classes.map((c) => {
          const yearsAhead = c.year - currentYear;
          return (
            <section key={c.key} className="mt-8" data-testid="future-class">
              <h2 className="text-lg font-semibold">
                {t("futureDraft.classTitle", { year: c.year })}{" "}
                <span className="text-sm font-normal text-muted">
                  {t("futureDraft.inYears", { count: yearsAhead })}
                </span>
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="data-table w-full min-w-[640px] text-sm">
                  <thead>
                    <tr>
                      <th className="py-1.5 text-left">#</th>
                      <th className="py-1.5 text-left">{t("futureDraft.col.player")}</th>
                      <th className="py-1.5 text-left">{t("futureDraft.col.pos")}</th>
                      <th className="py-1.5 text-right">{t("futureDraft.col.height")}</th>
                      <th className="py-1.5 pr-4 text-right">{t("futureDraft.col.age")}</th>
                      <th className="py-1.5 pr-4 text-left">{t("futureDraft.col.projection")}</th>
                      <th className="py-1.5 text-left">{t("futureDraft.col.team")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.list.map((p, i) => {
                      // Flou des recruteurs, élargi de 50 % par année d'avance.
                      const est = estimateRating(
                        p.overallRating,
                        scouting,
                        `${m.careerId}:${m.teamId}:${c.key}:${p.firstName}${p.lastName}`,
                        0.6 * (1 + 0.5 * (yearsAhead - 1))
                      );
                      return (
                        <tr key={`${p.firstName}-${p.lastName}`}>
                          <td className="py-1.5 text-faint">{i + 1}</td>
                          <td className="py-1.5 font-medium">
                            {p.firstName} {p.lastName}
                            {p.nationality && <span className="ml-1 text-xs text-muted">({p.nationality})</span>}
                          </td>
                          <td className="py-1.5">{p.position}</td>
                          <td className="py-1.5 text-right tabular">{p.heightCm} cm</td>
                          <td className="py-1.5 pr-4 text-right tabular">{p.age}</td>
                          <td className="py-1.5 pr-4 whitespace-nowrap">
                            <Stars value={ratingStars(est.mid)} />{" "}
                            <span className="text-xs text-faint tabular">
                              {est.low}-{est.high}
                            </span>
                          </td>
                          <td className="py-1.5 text-xs text-soft">{p.scoutingNote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
      <p className="mt-8 text-xs text-faint">{t("futureDraft.sources")}</p>
    </div>
  );
}

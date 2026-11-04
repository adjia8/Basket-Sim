import Link from "next/link";
import type { Player } from "@/lib/types";
import type { Translator } from "@/lib/i18n/translate";
import { DEVELOPMENT_MAX_AGE, PROGRESS_PER_OVERALL_POINT } from "@/lib/careers/development-rules";
import { playerHref } from "@/lib/utils";
import { IndividualFocusSelect } from "./IndividualFocusSelect";

// Entraînement individuel (onglet Entraînement de mon équipe) : travail de
// chaque joueur et progression des jeunes vers leur prochain point
// d'overall (voir development-rules.ts).
export function IndividualTrainingPanel({
  teamId,
  roster,
  t,
}: {
  teamId: string;
  roster: Player[];
  t: Translator;
}) {
  const options = [
    { value: "", label: t("team.individual.followTeam") },
    { value: "offensive", label: t("team.individual.offensive") },
    { value: "defensive", label: t("team.individual.defensive") },
    { value: "tactical", label: t("team.individual.tactical") },
    { value: "physical", label: t("team.individual.physical") },
  ];
  const sorted = [...roster].sort((a, b) => a.age - b.age || b.overallRating - a.overallRating);
  return (
    <section className="mt-6 card p-4">
      <h2 className="text-lg font-semibold">{t("team.individual.title")}</h2>
      <p className="mt-1 text-xs text-muted">{t("team.individual.explain")}</p>
      <p className="mt-1 text-xs text-muted">{t("team.individual.intensity")}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4">{t("roster.column.player")}</th>
              <th className="py-2 pr-4 text-right">{t("roster.column.age")}</th>
              <th className="py-2 pr-4 text-right">{t("roster.column.overall")}</th>
              <th className="py-2 pr-4">{t("team.individual.progress")}</th>
              <th className="py-2">{t("team.individual.focus")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const young = p.age <= DEVELOPMENT_MAX_AGE;
              const progress = p.developmentProgress ?? 0;
              return (
                <tr key={p.id}>
                  <td className="py-2 pr-4">
                    <Link href={playerHref(p.id, teamId)} className="font-medium hover:underline">
                      {p.firstName} {p.lastName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right">{p.age}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{p.overallRating}</td>
                  <td className="py-2 pr-4">
                    {young ? (
                      <span className="inline-flex gap-1" aria-label={`${progress}/${PROGRESS_PER_OVERALL_POINT}`}>
                        {Array.from({ length: PROGRESS_PER_OVERALL_POINT }, (_, i) => (
                          <span key={i} className={`h-2 w-4 rounded-sm ${i < progress ? "bg-accent" : "bg-surface-3"}`} />
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">{t("team.individual.veteran")}</span>
                    )}
                  </td>
                  <td className="py-2">
                    <IndividualFocusSelect playerId={p.id} value={p.individualFocus ?? ""} options={options} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

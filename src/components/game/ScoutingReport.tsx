import Link from "next/link";
import type { Player, PlayerRatings } from "@/lib/types";
import type { Translator } from "@/lib/i18n/translate";
import { personalityFor, personalityLabel } from "@/lib/careers/personality-rules";
import { playerHref } from "@/lib/utils";

// Rapport de scouting d'avant-match (mon prochain adversaire) : joueurs à
// surveiller et secteurs où l'adversaire domine ou souffre face à MON
// effectif (moyenne des 8 meilleurs de chaque côté, joueurs disponibles).

const RATING_KEYS: (keyof PlayerRatings)[] = [
  "scoringInside",
  "scoringOutside",
  "playmaking",
  "defenseInside",
  "defenseOutside",
  "rebounding",
  "athleticism",
  "basketballIQ",
];
const EDGE_THRESHOLD = 3;

function rotationAverage(roster: Player[], key: keyof PlayerRatings): number {
  const top = roster
    .filter((p) => !p.injured)
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 8);
  return top.length ? top.reduce((s, p) => s + p.ratings[key], 0) / top.length : 0;
}

export function ScoutingReport({
  opponentName,
  opponentTeamId,
  theirRoster,
  myRoster,
  ppgById,
  scouting,
  t,
}: {
  opponentName: string;
  opponentTeamId: string;
  theirRoster: Player[];
  myRoster: Player[];
  ppgById: Map<string, { ppg: number; rpg: number; apg: number; gamesPlayed: number }>;
  scouting: number;
  t: Translator;
}) {
  // Joueurs clés : meilleurs marqueurs de la saison, sinon meilleures notes.
  const key = [...theirRoster]
    .sort(
      (a, b) =>
        (ppgById.get(b.id)?.ppg ?? 0) - (ppgById.get(a.id)?.ppg ?? 0) || b.overallRating - a.overallRating
    )
    .slice(0, 3);
  const edges = RATING_KEYS.map((k) => ({
    key: k,
    diff: Math.round(rotationAverage(theirRoster, k) - rotationAverage(myRoster, k)),
  }));
  const strengths = edges.filter((e) => e.diff >= EDGE_THRESHOLD).sort((a, b) => b.diff - a.diff).slice(0, 3);
  const weaknesses = edges.filter((e) => e.diff <= -EDGE_THRESHOLD).sort((a, b) => a.diff - b.diff).slice(0, 3);
  const knowsPersonality = scouting >= 55;

  // Écart affiché du point de vue de l'équipe qui a l'avantage (toujours « + »).
  const edgeList = (list: typeof edges, tone: string, empty: string) =>
    list.length === 0 ? (
      <p className="text-faint">{empty}</p>
    ) : (
      <ul className="space-y-0.5">
        {list.map((e) => (
          <li key={e.key} className="flex justify-between gap-2">
            <span>{t(`rating.${e.key}`)}</span>
            <span className={`tabular font-semibold ${tone}`}>+{Math.abs(e.diff)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="mt-6 card p-4 text-sm" data-testid="scouting-report">
      <p className="eyebrow">{t("scout.title", { team: opponentName })}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <p className="mb-1 text-xs font-semibold text-muted">{t("scout.watch")}</p>
          <ul className="space-y-2">
            {key.map((p) => {
              const s = ppgById.get(p.id);
              const label = personalityLabel(personalityFor(p.id, p.age));
              return (
                <li key={p.id}>
                  <Link href={playerHref(p.id, opponentTeamId)} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>{" "}
                  <span className="text-xs text-muted">
                    {p.position} · {p.overallRating}
                  </span>
                  <p className="text-xs text-muted tabular">
                    {s && s.gamesPlayed > 0 ? t("scout.line", { pts: s.ppg, reb: s.rpg, ast: s.apg }) : t("scout.noStats")}
                    {p.injured && <span className="ml-1 text-bad">· {t("scout.injured")}</span>}
                  </p>
                  {knowsPersonality && label !== "balanced" && (
                    <p className="text-xs text-faint">
                      {t(`personality.label.${label}`)}
                      {(label === "fiery" || label === "hothead") && ` · ${t("scout.provoke")}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">{t("scout.strengths")}</p>
          {edgeList(strengths, "text-bad", t("scout.noStrengths"))}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">{t("scout.weaknesses")}</p>
          {edgeList(weaknesses, "text-good", t("scout.noWeaknesses"))}
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">{t("scout.hint")}</p>
    </div>
  );
}

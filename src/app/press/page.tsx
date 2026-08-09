import { getCurrentMembership } from "@/lib/auth/dal";
import { getOrCreateTeamState } from "@/lib/data-access/team-state";
import { getPendingPressConference, getPressHistory } from "@/lib/data-access/press";
import { submitPressAnswers } from "@/app/actions/press";
import { toneClass, neutralTone } from "@/lib/color-scale";

const CATEGORY_LABELS: Record<string, string> = {
  results: "Résultats",
  roster: "Effectif",
  management: "Direction",
  future: "Avenir",
};

export default async function PressPage() {
  const membership = await getCurrentMembership();

  const [teamState, pending, history] = await Promise.all([
    getOrCreateTeamState(membership.careerId, membership.teamId, membership.leagueId),
    getPendingPressConference(membership.careerId, membership.teamId),
    getPressHistory(membership.careerId, membership.teamId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Conférences de presse</h1>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Moral</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(neutralTone(teamState.morale))}`}>
            {teamState.morale} / 99
          </p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Opinion publique</p>
          <p className={`mt-1 text-xl font-semibold ${toneClass(neutralTone(teamState.publicOpinion))}`}>
            {teamState.publicOpinion} / 99
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Conférence en attente
        </h2>
        {!pending ? (
          <p className="text-sm text-black/50 dark:text-white/50">Aucune conférence en attente pour l&apos;instant.</p>
        ) : (
          <form action={submitPressAnswers} className="space-y-5">
            <input type="hidden" name="conferenceId" value={pending.id} />
            {pending.questions.map((question, i) => (
              <div key={question.id}>
                <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
                  {CATEGORY_LABELS[question.category] ?? question.category}
                </p>
                <p className="mt-1 font-medium">
                  {i + 1}. {question.prompt}
                </p>
                <div className="mt-2 space-y-1">
                  {question.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`answer_${question.id}`}
                        value={option.id}
                        required
                        className="accent-black dark:accent-white"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="submit"
              className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              Répondre
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Historique
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Aucune conférence passée pour l&apos;instant.</p>
        ) : (
          <div className="space-y-4">
            {history.map((conference) => (
              <div key={conference.id} className="border-b border-black/5 pb-3 last:border-0 dark:border-white/5">
                <p className="text-xs text-black/40 dark:text-white/40">{conference.gameDate}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {conference.questions.map((question) => {
                    const chosen = question.options.find((o) => o.id === question.chosenOptionId);
                    return (
                      <li key={question.id}>
                        <span className="text-black/60 dark:text-white/60">{question.prompt}</span>
                        {chosen && <span className="ml-1 font-medium">— {chosen.label}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

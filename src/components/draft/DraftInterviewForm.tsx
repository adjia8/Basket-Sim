"use client";

import { useActionState } from "react";
import { interviewProspect, type InterviewFormState } from "@/app/actions/draft-interview";

// Formulaire d'entretien d'avant-draft (voir draft-interview-rules.ts) :
// textes déjà traduits par la page Draft (Server Component).
export function DraftInterviewForm({
  prospects,
  questions,
  labels,
}: {
  prospects: { id: string; label: string }[];
  questions: { value: string; label: string }[];
  labels: { prospect: string; questions: string; submit: string; sending: string };
}) {
  const [state, action, pending] = useActionState<InterviewFormState | undefined, FormData>(interviewProspect, undefined);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3 text-sm" data-testid="interview-form">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">{labels.prospect}</span>
        <select name="prospectId" className="field px-2 py-1.5" disabled={pending}>
          {prospects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1" disabled={pending}>
        <legend className="mb-1 text-xs text-muted">{labels.questions}</legend>
        {questions.map((q) => (
          <label key={q.value} className="flex items-center gap-2">
            <input type="checkbox" name="questions" value={q.value} className="accent-[var(--accent)]" />
            {q.label}
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-1.5 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.sending : labels.submit}
      </button>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

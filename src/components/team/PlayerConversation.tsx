"use client";

import { useActionState, useState } from "react";
import { talkToPlayer, type ConversationFormState } from "@/app/actions/conversation";

// Discussion avec un joueur (voir player-conversation-rules.ts) : textes
// déjà traduits par la fiche joueur (Server Component).
export interface ConversationLabels {
  title: string;
  subtitle: string;
  topicLabel: string;
  toneLabel: string;
  submit: string;
  sending: string;
  you: string;
  cooldown: string | null;
  request: string | null; // « Il demande à te parler : … »
}

export function PlayerConversation({
  playerId,
  playerName,
  topics,
  tones,
  labels,
  defaultTopic,
}: {
  playerId: string;
  playerName: string;
  topics: { value: string; label: string }[];
  tones: { value: string; label: string }[];
  labels: ConversationLabels;
  defaultTopic?: string | null;
}) {
  const [state, action, pending] = useActionState<ConversationFormState | undefined, FormData>(talkToPlayer, undefined);
  const [tone, setTone] = useState(tones[0]?.value ?? "calm");
  const done = !!state?.reply;
  const reactionClass =
    state?.tone === "good" ? "bg-good/15 text-good" : state?.tone === "bad" ? "bg-bad/15 text-bad" : "bg-surface-3 text-soft";

  return (
    <div className="mt-6 card p-4" data-testid="player-conversation">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{labels.title}</h2>
      <p className="mt-1 text-xs text-faint">{labels.subtitle}</p>
      {labels.request && !done && (
        <p className="mt-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn" data-testid="player-request">
          {labels.request}
        </p>
      )}

      {labels.cooldown && !done ? (
        <p className="mt-3 text-sm text-muted">{labels.cooldown}</p>
      ) : (
        !done && (
          <form action={action} className="mt-3 flex flex-col gap-3 text-sm">
            <input type="hidden" name="playerId" value={playerId} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">{labels.topicLabel}</span>
              <select name="topic" className="field px-2 py-1.5" disabled={pending} defaultValue={defaultTopic ?? undefined}>
                {topics.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-wrap items-center gap-2" disabled={pending}>
              <legend className="mb-1 text-xs text-muted">{labels.toneLabel}</legend>
              {tones.map((t) => (
                <label
                  key={t.value}
                  className="cursor-pointer rounded-full border border-line px-3 py-1 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
                >
                  <input
                    type="radio"
                    name="tone"
                    value={t.value}
                    checked={tone === t.value}
                    onChange={() => setTone(t.value)}
                    className="sr-only"
                  />
                  {t.label}
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
          </form>
        )
      )}

      {state?.error && <p className="mt-3 text-sm text-bad">{state.error}</p>}
      {done && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="max-w-[85%] rounded-lg rounded-tl-none bg-surface-2 px-3 py-2">
            <p className="text-xs font-semibold text-muted">{labels.you}</p>
            <p>« {state.gmLine} »</p>
          </div>
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none border border-line px-3 py-2">
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
              {playerName}
              <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${reactionClass}`}>{state.reaction}</span>
            </p>
            <p>« {state.reply} »</p>
          </div>
          {state.effect && <p className="text-xs font-medium text-accent-text">{state.effect}</p>}
        </div>
      )}
    </div>
  );
}

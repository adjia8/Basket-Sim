"use client";

import { useFormStatus } from "react-dom";

// Boutons d'envoi de la conférence de presse : désactivés pendant l'envoi
// (l'application des effets prend quelques secondes) pour éviter un double
// envoi, avec un libellé d'attente.
export function PressSubmitButtons({
  skipAction,
  labels,
}: {
  skipAction: (formData: FormData) => Promise<void>;
  labels: { answer: string; skip: string; sending: string; skipHint: string };
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.sending : labels.answer}
      </button>
      <button
        type="submit"
        formAction={skipAction}
        formNoValidate
        disabled={pending}
        className="rounded-md border border-line px-4 py-1.5 text-sm font-medium transition hover:bg-surface-2 disabled:opacity-50"
      >
        {labels.skip}
      </button>
      <span className="text-xs text-muted">{labels.skipHint}</span>
    </div>
  );
}

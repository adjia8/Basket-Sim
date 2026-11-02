"use client";

import { useState, useTransition } from "react";
import { deleteCareer } from "@/app/actions/career";

export interface DeleteCareerLabels {
  button: string;
  confirmMessage: string;
  confirmButton: string;
  cancelButton: string;
  deleting: string;
}

export function DeleteCareerButton({ labels }: { labels: DeleteCareerLabels }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-bad/30 px-4 py-1.5 text-sm font-medium text-bad hover:bg-bad/10"
      >
        {labels.button}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-bad/30 bg-bad/5 p-4">
      <p className="text-sm text-bad">{labels.confirmMessage}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteCareer())}
          className="rounded-md bg-bad px-4 py-1.5 text-sm font-medium text-white transition hover:bg-bad/90 disabled:opacity-50"
        >
          {pending ? labels.deleting : labels.confirmButton}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-full border border-line px-4 py-1.5 text-sm"
        >
          {labels.cancelButton}
        </button>
      </div>
    </div>
  );
}

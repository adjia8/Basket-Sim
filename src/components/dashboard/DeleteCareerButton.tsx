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
        className="rounded-full border border-red-500/30 px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
      >
        {labels.button}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-sm text-red-500">{labels.confirmMessage}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteCareer())}
          className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {pending ? labels.deleting : labels.confirmButton}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-full border border-black/10 px-4 py-1.5 text-sm dark:border-white/10"
        >
          {labels.cancelButton}
        </button>
      </div>
    </div>
  );
}

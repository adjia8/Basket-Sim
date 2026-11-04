"use client";

import { useRef } from "react";
import { setIndividualFocus } from "@/app/actions/roster";

// Menu d'entraînement individuel enregistré dès qu'on change la valeur
// (pas de bouton « Enregistrer » par ligne).
export function IndividualFocusSelect({
  playerId,
  value,
  options,
}: {
  playerId: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setIndividualFocus}>
      <input type="hidden" name="playerId" value={playerId} />
      <select
        key={value}
        name="focus"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className="field px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}

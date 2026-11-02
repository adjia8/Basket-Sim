"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCodeForm({ placeholder, button }: { placeholder: string; button: string }) {
  const [code, setCode] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) router.push(`/onboarding?code=${encodeURIComponent(code.trim())}`);
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={placeholder}
        maxLength={6}
        className="field px-3 py-2 text-sm uppercase tracking-widest"
      />
      <button
        type="submit"
        className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-surface-3"
      >
        {button}
      </button>
    </form>
  );
}

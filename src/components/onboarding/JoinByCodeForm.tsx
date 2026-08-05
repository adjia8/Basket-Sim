"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCodeForm() {
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
        placeholder="Code d'invitation (ex: A3F9K2)"
        maxLength={6}
        className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm uppercase tracking-widest dark:border-white/10"
      />
      <button
        type="submit"
        className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
      >
        Rejoindre
      </button>
    </form>
  );
}

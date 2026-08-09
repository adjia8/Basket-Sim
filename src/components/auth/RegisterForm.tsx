"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir app/register/page.tsx).
export interface RegisterFormLabels {
  email: string;
  password: string;
  passwordMinLength: string;
  registerButton: string;
  registering: string;
  alreadyAccount: string;
  loginButton: string;
}

export function RegisterForm({ labels }: { labels: RegisterFormLabels }) {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">{labels.passwordMinLength}</p>
      </div>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-black px-6 py-2 font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? labels.registering : labels.registerButton}
      </button>

      <p className="text-center text-sm text-black/50 dark:text-white/50">
        {labels.alreadyAccount}{" "}
        <Link href="/login" className="underline underline-offset-2">
          {labels.loginButton}
        </Link>
      </p>
    </form>
  );
}

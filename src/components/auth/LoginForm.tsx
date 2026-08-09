"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir app/login/page.tsx).
export interface LoginFormLabels {
  email: string;
  password: string;
  loginButton: string;
  loggingIn: string;
  noAccountYet: string;
  createAccount: string;
}

export function LoginForm({ labels }: { labels: LoginFormLabels }) {
  const [state, action, pending] = useActionState(login, undefined);

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
          className="w-full rounded-lg border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </div>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-black px-6 py-2 font-medium text-white transition hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? labels.loggingIn : labels.loginButton}
      </button>

      <p className="text-center text-sm text-black/50 dark:text-white/50">
        {labels.noAccountYet}{" "}
        <Link href="/register" className="underline underline-offset-2">
          {labels.createAccount}
        </Link>
      </p>
    </form>
  );
}

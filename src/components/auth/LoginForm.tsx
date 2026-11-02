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
          className="w-full field px-3 py-2"
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
          className="w-full field px-3 py-2"
        />
      </div>

      {state?.error && <p className="text-sm text-bad">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-6 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.loggingIn : labels.loginButton}
      </button>

      <p className="text-center text-sm text-muted">
        {labels.noAccountYet}{" "}
        <Link href="/register" className="underline underline-offset-2">
          {labels.createAccount}
        </Link>
      </p>
    </form>
  );
}

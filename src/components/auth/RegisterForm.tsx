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
          minLength={8}
          className="w-full field px-3 py-2"
        />
        <p className="mt-1 text-xs text-faint">{labels.passwordMinLength}</p>
      </div>

      {state?.error && <p className="text-sm text-bad">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-6 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? labels.registering : labels.registerButton}
      </button>

      <p className="text-center text-sm text-muted">
        {labels.alreadyAccount}{" "}
        <Link href="/login" className="underline underline-offset-2">
          {labels.loginButton}
        </Link>
      </p>
    </form>
  );
}

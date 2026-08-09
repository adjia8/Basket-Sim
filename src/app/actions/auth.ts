"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/translate";

export interface AuthFormState {
  error?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signup(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const { t } = await getTranslator();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isValidEmail(email)) {
    return { error: t("auth.invalidEmail") };
  }
  if (password.length < 8) {
    return { error: t("auth.passwordTooShort") };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("auth.emailTaken") };
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function login(
  _prevState: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const { t } = await getTranslator();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: t("auth.invalidCredentials") };
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  const membership = await prisma.membership.findUnique({ where: { userId: user.id } });
  redirect(membership ? "/" : "/onboarding");
}

export async function logout(): Promise<void> {
  await deleteSession();
  revalidatePath("/", "layout");
  redirect("/login");
}

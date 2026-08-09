import { LoginForm } from "@/components/auth/LoginForm";
import { getTranslator } from "@/lib/i18n/translate";

export default async function LoginPage() {
  const { t } = await getTranslator();
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">{t("auth.loginPageTitle")}</h1>
      <LoginForm
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          loginButton: t("auth.loginButton"),
          loggingIn: t("auth.loggingIn"),
          noAccountYet: t("auth.noAccountYet"),
          createAccount: t("auth.createAccount"),
        }}
      />
    </div>
  );
}

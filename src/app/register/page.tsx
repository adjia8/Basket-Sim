import { RegisterForm } from "@/components/auth/RegisterForm";
import { getTranslator } from "@/lib/i18n/translate";

export default async function RegisterPage() {
  const { t } = await getTranslator();
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">{t("auth.createAccount")}</h1>
      <RegisterForm
        labels={{
          email: t("auth.email"),
          password: t("auth.password"),
          passwordMinLength: t("auth.passwordMinLength"),
          registerButton: t("auth.registerButton"),
          registering: t("auth.registering"),
          alreadyAccount: t("auth.alreadyAccount"),
          loginButton: t("auth.loginButton"),
        }}
      />
    </div>
  );
}

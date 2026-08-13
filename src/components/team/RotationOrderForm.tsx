import { getTranslator } from "@/lib/i18n/translate";
import { RotationOrderFormClient } from "./RotationOrderFormClient";
import type { RotationOrderPlayer } from "@/lib/careers/rotation-rules";

export async function RotationOrderForm({ initialOrder }: { initialOrder: RotationOrderPlayer[] }) {
  const { t } = await getTranslator();

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("rotation.title")}</h2>
      <RotationOrderFormClient
        initialOrder={initialOrder}
        labels={{
          description: t("rotation.description"),
          roleStarter: t("rotation.role.starter"),
          roleSixthWoman: t("rotation.role.sixthWoman"),
          roleBench: t("rotation.role.bench"),
          roleOutOfRotation: t("rotation.role.outOfRotation"),
          moveUp: t("rotation.moveUp"),
          moveDown: t("rotation.moveDown"),
          save: t("rotation.save"),
          saving: t("rotation.saving"),
        }}
      />
    </div>
  );
}

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
          activeHeading: t("rotation.activeHeading"),
          reserveHeading: t("rotation.reserveHeading"),
          roleStarter: t("rotation.role.starter"),
          roleSixthWoman: t("rotation.role.sixthWoman"),
          roleBench: t("rotation.role.bench"),
          dragHandle: t("rotation.dragHandle"),
          addToRotation: t("rotation.addToRotation"),
          removeFromRotation: t("rotation.removeFromRotation"),
          save: t("rotation.save"),
          saving: t("rotation.saving"),
        }}
      />
    </div>
  );
}

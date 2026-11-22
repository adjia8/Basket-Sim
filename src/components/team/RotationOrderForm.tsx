import { getTranslator } from "@/lib/i18n/translate";
import { RotationOrderFormClient, type RotationSuggestionView } from "./RotationOrderFormClient";
import type { RotationOrderPlayer } from "@/lib/careers/rotation-rules";

export async function RotationOrderForm({
  teamId,
  initialOrder,
  suggestion,
}: {
  teamId: string;
  initialOrder: RotationOrderPlayer[];
  suggestion?: RotationSuggestionView | null;
}) {
  const { t } = await getTranslator();

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("rotation.title")}</h2>
      <RotationOrderFormClient
        teamId={teamId}
        initialOrder={initialOrder}
        suggestion={suggestion}
        labels={{
          advice: {
            show: t("rotation.advice.show"),
            hide: t("rotation.advice.hide"),
            by: t("rotation.advice.by"),
            noAdviser: t("rotation.advice.noAdviser"),
            confidence: {
              high: t("rotation.advice.confidence.high"),
              medium: t("rotation.advice.confidence.medium"),
              low: t("rotation.advice.confidence.low"),
            },
            note: {
              starter: t("rotation.advice.note.starter"),
              offPosition: t("rotation.advice.note.offPosition"),
              sixth: t("rotation.advice.note.sixth"),
              bench: t("rotation.advice.note.bench"),
              rest: t("rotation.advice.note.rest"),
              wear: t("rotation.advice.note.wear"),
              injured: t("rotation.advice.note.injured"),
              reserve: t("rotation.advice.note.reserve"),
            },
            positions: {
              PG: t("rotation.advice.pos.PG"),
              SG: t("rotation.advice.pos.SG"),
              SF: t("rotation.advice.pos.SF"),
              PF: t("rotation.advice.pos.PF"),
              C: t("rotation.advice.pos.C"),
            },
            apply: t("rotation.advice.apply"),
            applied: t("rotation.advice.applied"),
          },
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
          injury: {
            long: t("rotation.injury.long"),
            soon: t("rotation.injury.soon"),
            imminent: t("rotation.injury.imminent"),
            discomfort: t("rotation.injury.discomfort"),
          },
        }}
      />
    </div>
  );
}

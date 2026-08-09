"use client";

import { useActionState } from "react";
import { joinCareer } from "@/app/actions/career";
import { FranchiseCarousel, type FranchiseCarouselLabels } from "./FranchiseCarousel";
import type { Locale } from "@/lib/i18n/locale";
import type { FranchiseSummary } from "@/lib/data-access/franchise-summary";

export function JoinCareerForm({
  inviteCode,
  slides,
  locale,
  labels,
}: {
  inviteCode: string;
  slides: FranchiseSummary[];
  locale: Locale;
  labels: FranchiseCarouselLabels;
}) {
  const [state, action, pending] = useActionState(joinCareer, undefined);

  return (
    <FranchiseCarousel
      slides={slides}
      mode="join"
      action={action}
      hiddenFields={{ inviteCode }}
      error={state?.error}
      pending={pending}
      locale={locale}
      labels={labels}
    />
  );
}

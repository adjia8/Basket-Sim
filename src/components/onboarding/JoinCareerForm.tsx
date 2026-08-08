"use client";

import { useActionState } from "react";
import { joinCareer } from "@/app/actions/career";
import { FranchiseCarousel } from "./FranchiseCarousel";
import type { FranchiseSummary } from "@/lib/data-access/franchise-summary";

export function JoinCareerForm({
  inviteCode,
  slides,
}: {
  inviteCode: string;
  slides: FranchiseSummary[];
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
    />
  );
}

"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { teamFullName, formatSalary } from "@/lib/utils";
import { GM_POINT_POOL, type ExpectationTier } from "@/lib/careers/gm-rules";
import type { FranchiseSummary } from "@/lib/data-access/franchise-summary";

// Composant client : tout le texte arrive déjà traduit en props depuis le
// Server Component appelant (voir onboarding/page.tsx, onboarding/reassign/
// page.tsx) — jamais de fonction `t` passée à travers la frontière
// serveur/client. Les phrases avec variable sont scindées en un préfixe
// traduit + la donnée brute, plutôt qu'interpolées ici.
export interface FranchiseCarouselLabels {
  noneAvailable: string;
  objectivePrefix: string;
  alreadyTakenPrefix: string;
  treasury: string;
  roster: string;
  playersUnit: string;
  avgOverallSuffix: string;
  facilities: string;
  trainingStaff: string;
  topPlayers: string;
  draftPicksHeading: string;
  pickNumberPrefix: string;
  pickRoundPrefix: string;
  previous: string;
  next: string;
  chooseThis: string;
  confirm: string;
  createGm: string;
  firstName: string;
  lastName: string;
  age: string;
  sex: string;
  pointsAllocationPrefix: string;
  pointsDescription: string;
  changeFranchise: string;
  takeCommand: string;
  expectationTier: Record<ExpectationTier, string>;
  sexOptions: { value: string; label: string }[];
  gmCategories: { key: "offense" | "defense" | "physical" | "tactical" | "chemistry"; label: string }[];
}

function Bar({ level }: { level: number }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div className="h-full rounded-full bg-black dark:bg-white" style={{ width: `${level}%` }} />
    </div>
  );
}

export function FranchiseCarousel({
  slides,
  mode,
  action,
  hiddenFields,
  error,
  pending,
  locale,
  labels,
}: {
  slides: FranchiseSummary[];
  mode: "create" | "join" | "reassign";
  action: (formData: FormData) => void;
  hiddenFields?: Record<string, string>;
  error?: string;
  pending?: boolean;
  locale: Locale;
  labels: FranchiseCarouselLabels;
}) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<"team" | "gm">("team");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState(45);
  const [sex, setSex] = useState("M");
  const [points, setPoints] = useState<Record<string, number>>({
    offense: 4,
    defense: 4,
    physical: 4,
    tactical: 4,
    chemistry: 4,
  });

  const requiresGmStep = mode !== "reassign";
  const slide = slides[index];
  const pointsTotal = Object.values(points).reduce((sum, p) => sum + p, 0);
  const pointsRemaining = GM_POINT_POOL - pointsTotal;

  function setPoint(key: string, value: number) {
    setPoints((prev) => {
      // Le plafond de CE champ dépend de ce qui est déjà alloué ailleurs :
      // un simple clamp [0, GM_POINT_POOL] par champ laissait le total
      // dépasser le pool (ex. 20 partout), rendant "points restants"
      // négatif — le bouton de soumission bloquait déjà ce cas, mais
      // l'affichage intermédiaire ne devait jamais pouvoir descendre sous 0.
      const othersTotal = Object.entries(prev).reduce(
        (sum, [k, v]) => (k === key ? sum : sum + v),
        0
      );
      const maxForField = Math.max(0, GM_POINT_POOL - othersTotal);
      return { ...prev, [key]: Math.max(0, Math.min(maxForField, value)) };
    });
  }

  if (!slide) {
    return <p className="text-sm text-black/50 dark:text-white/50">{labels.noneAvailable}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div
        className="rounded-xl border border-black/10 p-6 dark:border-white/10"
        style={{ borderTopColor: slide.team.primaryColor, borderTopWidth: 4 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-black/50 dark:text-white/50">{slide.team.abbreviation}</p>
            <h3 className="text-xl font-bold">{teamFullName(slide.team)}</h3>
          </div>
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium dark:bg-white/10">
            {labels.objectivePrefix} {labels.expectationTier[slide.expectationTier]}
          </span>
        </div>

        {slide.managedByEmail && (
          <p className="mt-2 text-xs text-black/40 dark:text-white/40">
            {labels.alreadyTakenPrefix} {slide.managedByEmail}
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{labels.treasury}</p>
            <p className="mt-0.5 text-lg font-semibold">{formatSalary(slide.finances, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{labels.roster}</p>
            <p className="mt-0.5 text-lg font-semibold">
              {slide.rosterSize} {labels.playersUnit} · {Math.round(slide.averageOverall)} {labels.avgOverallSuffix}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{labels.facilities}</p>
            <Bar level={slide.facilitiesLevel} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{labels.trainingStaff}</p>
            <Bar level={slide.trainingStaffLevel} />
          </div>
        </div>

        {slide.topPlayers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{labels.topPlayers}</p>
            <ul className="mt-1 flex flex-wrap gap-2 text-sm">
              {slide.topPlayers.map((p, i) => (
                <li key={i} className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
                  {p.firstName} {p.lastName} ({p.overallRating})
                </li>
              ))}
            </ul>
          </div>
        )}

        {slide.draftPicks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
              {labels.draftPicksHeading}
            </p>
            <ul className="mt-1 flex flex-wrap gap-2 text-sm">
              {slide.draftPicks.map((pick, i) => (
                <li key={i} className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
                  {pick.pickNumber !== null
                    ? `${labels.pickNumberPrefix} ${pick.pickNumber}`
                    : `${labels.pickRoundPrefix} ${pick.round}`}{" "}
                  ({pick.season})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm disabled:opacity-30 dark:border-white/10"
        >
          {labels.previous}
        </button>
        <span className="text-xs text-black/40 dark:text-white/40">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={index === slides.length - 1}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm disabled:opacity-30 dark:border-white/10"
        >
          {labels.next}
        </button>
      </div>

      {step === "team" && requiresGmStep && (
        <button
          type="button"
          disabled={Boolean(slide.managedByEmail)}
          onClick={() => setStep("gm")}
          className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {labels.chooseThis}
        </button>
      )}

      {step === "team" && !requiresGmStep && (
        <form action={action}>
          {hiddenFields &&
            Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
          <input type="hidden" name="teamId" value={slide.team.id} />
          <button
            type="submit"
            disabled={pending || Boolean(slide.managedByEmail)}
            className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {labels.confirm}
          </button>
        </form>
      )}

      {step === "gm" && requiresGmStep && (
        <form action={action} className="space-y-4 rounded-xl border border-black/10 p-6 dark:border-white/10">
          {hiddenFields &&
            Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
          <input type="hidden" name="teamId" value={slide.team.id} />

          <h3 className="text-lg font-semibold">{labels.createGm}</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {labels.firstName}
              <input
                type="text"
                name="gmFirstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {labels.lastName}
              <input
                type="text"
                name="gmLastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {labels.age}
              <input
                type="number"
                name="gmAge"
                min={25}
                max={80}
                required
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {labels.sex}
              <select
                name="gmSex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
              >
                {labels.sexOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">
              {labels.pointsAllocationPrefix} {pointsRemaining}/{GM_POINT_POOL}
            </p>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">{labels.pointsDescription}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {labels.gmCategories.map((cat) => (
                <label key={cat.key} className="flex items-center justify-between gap-3 text-sm">
                  {cat.label}
                  <input
                    type="number"
                    name={`gm${cat.key.charAt(0).toUpperCase()}${cat.key.slice(1)}Points`}
                    min={0}
                    max={GM_POINT_POOL}
                    value={points[cat.key]}
                    onChange={(e) => setPoint(cat.key, Number(e.target.value))}
                    className="w-20 rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("team")}
              className="rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/10"
            >
              {labels.changeFranchise}
            </button>
            <button
              type="submit"
              disabled={pending || pointsRemaining !== 0}
              className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              {labels.takeCommand}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { teamFullName, formatSalary } from "@/lib/utils";
import { EXPECTATION_LABELS, GM_POINT_POOL } from "@/lib/careers/gm-rules";
import type { FranchiseSummary } from "@/lib/data-access/franchise-summary";

const SEX_OPTIONS: { value: string; label: string }[] = [
  { value: "M", label: "Homme" },
  { value: "F", label: "Femme" },
  { value: "autre", label: "Autre" },
];

const GM_CATEGORIES: { key: "offense" | "defense" | "physical" | "tactical" | "chemistry"; label: string }[] = [
  { key: "offense", label: "Offensif" },
  { key: "defense", label: "Défensif" },
  { key: "physical", label: "Physique" },
  { key: "tactical", label: "Tactique" },
  { key: "chemistry", label: "Cohésion d'équipe" },
];

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
}: {
  slides: FranchiseSummary[];
  mode: "create" | "join" | "reassign";
  action: (formData: FormData) => void;
  hiddenFields?: Record<string, string>;
  error?: string;
  pending?: boolean;
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
    setPoints((prev) => ({ ...prev, [key]: Math.max(0, Math.min(GM_POINT_POOL, value)) }));
  }

  if (!slide) {
    return <p className="text-sm text-black/50 dark:text-white/50">Aucune franchise disponible.</p>;
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
            Objectif : {EXPECTATION_LABELS[slide.expectationTier]}
          </span>
        </div>

        {slide.managedByEmail && (
          <p className="mt-2 text-xs text-black/40 dark:text-white/40">Déjà prise par {slide.managedByEmail}</p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Trésorerie</p>
            <p className="mt-0.5 text-lg font-semibold">{formatSalary(slide.finances)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Effectif</p>
            <p className="mt-0.5 text-lg font-semibold">
              {slide.rosterSize} joueurs · {Math.round(slide.averageOverall)} overall moy.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Infrastructures</p>
            <Bar level={slide.facilitiesLevel} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Personnel de training</p>
            <Bar level={slide.trainingStaffLevel} />
          </div>
        </div>

        {slide.topPlayers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Meilleurs joueurs</p>
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
            <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Picks de draft</p>
            <ul className="mt-1 flex flex-wrap gap-2 text-sm">
              {slide.draftPicks.map((pick, i) => (
                <li key={i} className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
                  {pick.pickNumber !== null ? `Pick ${pick.pickNumber}` : `Tour ${pick.round}`} ({pick.season})
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
          ← Précédent
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
          Suivant →
        </button>
      </div>

      {step === "team" && requiresGmStep && (
        <button
          type="button"
          disabled={Boolean(slide.managedByEmail)}
          onClick={() => setStep("gm")}
          className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Choisir cette franchise
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
            Confirmer
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

          <h3 className="text-lg font-semibold">Crée ton GM</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Prénom
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
              Nom
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
              Âge
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
              Sexe
              <select
                name="gmSex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-1.5 text-sm dark:border-white/10"
              >
                {SEX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">
              Répartition des points d&apos;attributs — Points restants : {pointsRemaining}/{GM_POINT_POOL}
            </p>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              Donne un bonus permanent à ton équipe dans les catégories correspondantes.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {GM_CATEGORIES.map((cat) => (
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
              ← Changer de franchise
            </button>
            <button
              type="submit"
              disabled={pending || pointsRemaining !== 0}
              className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              Prendre les commandes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

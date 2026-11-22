"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { previewTrade, proposeTrade, type TradePreview } from "@/app/actions/trade";
import type { Locale } from "@/lib/i18n/locale";
import { formatSalary } from "@/lib/utils";
import type { RosterPlayer } from "./RosterTable";

export interface TradePick {
  id: string;
  season: string;
  round: number;
  pickNumber: number | null;
  originalTeamId: string;
  teamId: string;
  originalTeamAbbreviation: string;
  // Déjà traduit/interpolé côté serveur (voir teams/[teamId]/page.tsx) — un
  // Server Component ne peut pas passer de fonction à un Client Component.
  label: string;
}

// Centre des transferts (voir trade-analysis.ts) : tout le texte arrive déjà
// traduit depuis le Server Component appelant.
export interface TradeProposalLabels {
  title: string;
  myPlayersToOffer: string;
  myPicksToOffer: string;
  theirPlayersToReceive: string;
  theirPicksToReceive: string;
  proposing: string;
  proposeButton: string;
  summaryTitle: string;
  me: string;
  them: string;
  salaryOut: string;
  salaryIn: string;
  payrollAfter: string;
  rosterAfter: string;
  overCap: string;
  overTax: string;
  rulesOk: string;
  pickSomething: string;
  humanOpponent: string;
  interestTitle: string;
  outlook: Record<string, string>; // rebuild / middle / contender
  outlookHint: Record<string, string>;
  interest: Record<string, string>; // high / medium / low / none
  refusal: Record<string, string>; // value / rebuild / contender / salary
  suggestion: string; // « Pour qu'ils acceptent, ajoute : {item} »
  addSuggestion: string;
  age: string;
  years: string;
}

const INTEREST_TONE: Record<string, string> = {
  high: "bg-good",
  medium: "bg-good/70",
  low: "bg-warn",
  none: "bg-bad",
};
const INTEREST_LEVEL: Record<string, number> = { none: 1, low: 2, medium: 3, high: 4 };

export function TradeProposalForm({
  myRoster,
  theirRoster,
  myTeamId,
  myPicks,
  theirPicks,
  opponentTeamId,
  locale,
  labels,
  initialSelection,
  counter,
}: {
  initialSelection?: { myPlayerIds: string[]; theirPlayerIds: string[]; myPickIds: string[]; theirPickIds: string[] };
  // Négociation d'une offre reçue (contre-proposition).
  counter?: { offerId: string; title: string; hint: string; button: string; backLabel: string };
  myRoster: RosterPlayer[];
  theirRoster: RosterPlayer[];
  myTeamId: string;
  myPicks: TradePick[];
  theirPicks: TradePick[];
  opponentTeamId: string;
  locale: Locale;
  labels: TradeProposalLabels;
}) {
  const [state, action, pending] = useActionState(proposeTrade, undefined);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({
    myPlayerIds: new Set(initialSelection?.myPlayerIds),
    theirPlayerIds: new Set(initialSelection?.theirPlayerIds),
    myPickIds: new Set(initialSelection?.myPickIds),
    theirPickIds: new Set(initialSelection?.theirPickIds),
  });
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const toggle = (group: string, id: string) =>
    setSelected((prev) => {
      const next = new Set(prev[group]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [group]: next };
    });

  const total = Object.values(selected).reduce((n, s) => n + s.size, 0);

  // Aperçu en direct : recalculé côté serveur (mêmes règles que la
  // proposition) à chaque changement, avec un petit délai.
  useEffect(() => {
    if (total === 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const fd = new FormData();
      fd.set("opponentTeamId", opponentTeamId);
      for (const [group, ids] of Object.entries(selected)) for (const v of ids) fd.append(group, v);
      const res = await previewTrade(fd).catch(() => null);
      if (id === requestId.current) {
        setPreview(res);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selected, opponentTeamId, total]);

  const suggestionLabel = (() => {
    const s = preview?.suggestion;
    if (!s) return null;
    if (s.kind === "pick") return myPicks.find((p) => p.id === s.id)?.label ?? null;
    const p = myRoster.find((r) => r.id === s.id);
    return p ? `${p.firstName} ${p.lastName} (${p.overallRating})` : null;
  })();
  const shown = total > 0 ? preview : null;

  return (
    <div className="mt-8 card p-4" data-testid="trade-center">
      <h2 className="text-lg font-semibold">{counter ? counter.title : labels.title}</h2>
      {counter && (
        <p className="mt-2 rounded border border-info/40 bg-info/5 px-3 py-2 text-sm text-soft" data-testid="counter-banner">
          {counter.hint}
        </p>
      )}

      <form action={action} className="mt-4">
        <input type="hidden" name="opponentTeamId" value={opponentTeamId} />
        {counter && !state?.negotiationOver && <input type="hidden" name="counterOfferId" value={counter.offerId} />}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <PlayerCheckboxList
              title={labels.myPlayersToOffer}
              name="myPlayerIds"
              roster={myRoster}
              teamId={myTeamId}
              locale={locale}
              selected={selected.myPlayerIds}
              onToggle={toggle}
              labels={labels}
            />
            <PickCheckboxList title={labels.myPicksToOffer} name="myPickIds" picks={myPicks} selected={selected.myPickIds} onToggle={toggle} />
          </div>
          <div className="space-y-6">
            <PlayerCheckboxList
              title={labels.theirPlayersToReceive}
              name="theirPlayerIds"
              roster={theirRoster}
              teamId={opponentTeamId}
              locale={locale}
              selected={selected.theirPlayerIds}
              onToggle={toggle}
              labels={labels}
            />
            <PickCheckboxList
              title={labels.theirPicksToReceive}
              name="theirPickIds"
              picks={theirPicks}
              selected={selected.theirPickIds}
              onToggle={toggle}
            />
          </div>

          {/* Récapitulatif en direct, collé en haut de l'écran pendant le montage. */}
          <aside className="h-fit space-y-3 rounded-lg border border-line bg-surface-2/50 p-3 text-sm lg:sticky lg:top-20" data-testid="trade-summary">
            <h3 className="eyebrow flex items-center justify-between">
              {labels.summaryTitle}
              {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />}
            </h3>
            {!shown ? (
              <p className="text-xs text-muted">{labels.pickSomething}</p>
            ) : shown.error ? (
              <p className="text-xs text-bad">{shown.error}</p>
            ) : (
              <>
                <SideSummary title={labels.me} side={shown.me!} cap={shown.salaryCap!} tax={shown.taxLine!} locale={locale} labels={labels} />
                <SideSummary title={labels.them} side={shown.them!} cap={shown.salaryCap!} tax={shown.taxLine!} locale={locale} labels={labels} />
                {shown.rosterError || shown.capError ? (
                  <p className="rounded bg-bad/10 px-2 py-1 text-xs text-bad" data-testid="trade-rules">
                    {shown.rosterError ?? shown.capError}
                  </p>
                ) : (
                  <p className="rounded bg-good/10 px-2 py-1 text-xs text-good" data-testid="trade-rules">
                    ✓ {labels.rulesOk}
                  </p>
                )}
                {shown.opponentHuman ? (
                  <p className="text-xs text-muted">{labels.humanOpponent}</p>
                ) : (
                  shown.interest && (
                    <div data-testid="trade-interest" data-interest={shown.interest}>
                      <p className="eyebrow mb-1">{labels.interestTitle}</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <span
                            key={n}
                            className={`h-2 flex-1 rounded-full ${n <= INTEREST_LEVEL[shown.interest!] ? INTEREST_TONE[shown.interest!] : "bg-surface-3"}`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 font-medium">{labels.interest[shown.interest]}</p>
                      {shown.outlook && (
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-medium text-soft">{labels.outlook[shown.outlook]}</span> — {labels.outlookHint[shown.outlook]}
                        </p>
                      )}
                      {shown.complete && shown.refusal && <p className="mt-1 text-xs text-warn">{labels.refusal[shown.refusal]}</p>}
                      {suggestionLabel && shown.suggestion && (
                        <div className="mt-2 rounded border border-accent/40 bg-accent/5 p-2 text-xs" data-testid="trade-suggestion">
                          <p>{labels.suggestion.replace("{item}", suggestionLabel)}</p>
                          <button
                            type="button"
                            onClick={() =>
                              toggle(shown.suggestion!.kind === "pick" ? "myPickIds" : "myPlayerIds", shown.suggestion!.id)
                            }
                            className="mt-1.5 rounded bg-accent px-2 py-0.5 font-semibold text-accent-fg hover:bg-accent-hover"
                          >
                            {labels.addSuggestion}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </aside>
        </div>

        {state?.error && <p className="mt-4 text-sm text-bad">{state.error}</p>}
        {state?.success && <p className="mt-4 text-sm text-good">{state.success}</p>}
        {counter && (state?.success || state?.negotiationOver) && (
          <Link href="/trades" className="mt-2 inline-block text-sm text-accent-text hover:underline" data-testid="counter-back">
            {counter.backLabel}
          </Link>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-md bg-accent px-6 py-2 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? labels.proposing : counter && !state?.negotiationOver ? counter.button : labels.proposeButton}
        </button>
      </form>
    </div>
  );
}

function SideSummary({
  title,
  side,
  cap,
  tax,
  locale,
  labels,
}: {
  title: string;
  side: NonNullable<TradePreview["me"]>;
  cap: number;
  tax: number;
  locale: Locale;
  labels: TradeProposalLabels;
}) {
  const fmt = (n: number) => formatSalary(n, locale);
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 text-xs">
        <dt className="text-muted">{labels.salaryOut}</dt>
        <dd className="text-right tabular">{side.salaryOut > 0 ? `−${fmt(side.salaryOut)}` : "—"}</dd>
        <dt className="text-muted">{labels.salaryIn}</dt>
        <dd className="text-right tabular">{side.salaryIn > 0 ? `+${fmt(side.salaryIn)}` : "—"}</dd>
        <dt className="text-muted">{labels.payrollAfter}</dt>
        <dd className={`text-right font-semibold tabular ${side.payrollAfter > tax ? "text-bad" : side.payrollAfter > cap ? "text-warn" : "text-good"}`}>
          {fmt(side.payrollAfter)}
        </dd>
        <dt className="text-muted">{labels.rosterAfter}</dt>
        <dd className="text-right tabular">
          {side.rosterBefore} → {side.rosterAfter}
        </dd>
      </dl>
      {side.payrollAfter > tax ? (
        <p className="mt-0.5 text-[11px] text-bad">{labels.overTax}</p>
      ) : side.payrollAfter > cap ? (
        <p className="mt-0.5 text-[11px] text-warn">{labels.overCap}</p>
      ) : null}
    </div>
  );
}

function PlayerCheckboxList({
  title,
  name,
  roster,
  teamId,
  locale,
  selected,
  onToggle,
  labels,
}: {
  title: string;
  name: "myPlayerIds" | "theirPlayerIds";
  roster: RosterPlayer[];
  teamId: string;
  locale: Locale;
  selected: Set<string>;
  onToggle: (group: string, id: string) => void;
  labels: TradeProposalLabels;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-soft">{title}</h3>
      <ul className="space-y-1">
        {[...roster]
          .sort((a, b) => b.overallRating - a.overallRating)
          .map((player) => (
            <li key={player.id}>
              <label
                className={`flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-surface-2 ${selected.has(player.id) ? "bg-accent/10" : ""}`}
              >
                <input
                  type="checkbox"
                  name={name}
                  value={player.id}
                  checked={selected.has(player.id)}
                  onChange={() => onToggle(name, player.id)}
                />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/teams/${teamId}/players/${player.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {player.firstName} {player.lastName}
                  </Link>{" "}
                  <span className="text-faint">
                    ({player.position}, {player.overallRating})
                  </span>
                  <span className="block text-[11px] text-faint">
                    {player.age} {labels.age} · {player.yearsRemaining} {labels.years}
                  </span>
                </span>
                <span className="whitespace-nowrap text-muted tabular">{formatSalary(player.salary, locale)}</span>
              </label>
            </li>
          ))}
      </ul>
    </div>
  );
}

function PickCheckboxList({
  title,
  name,
  picks,
  selected,
  onToggle,
}: {
  title: string;
  name: "myPickIds" | "theirPickIds";
  picks: TradePick[];
  selected: Set<string>;
  onToggle: (group: string, id: string) => void;
}) {
  if (picks.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-soft">{title}</h3>
      <ul className="space-y-1">
        {picks.map((pick) => (
          <li key={pick.id}>
            <label
              className={`flex items-center gap-2 rounded px-2 py-1 text-sm transition hover:bg-surface-2 ${selected.has(pick.id) ? "bg-accent/10" : ""}`}
            >
              <input
                type="checkbox"
                name={name}
                value={pick.id}
                checked={selected.has(pick.id)}
                onChange={() => onToggle(name, pick.id)}
              />
              <span className="flex-1">{pick.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

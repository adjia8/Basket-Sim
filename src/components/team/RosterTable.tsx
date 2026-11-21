"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ContractType, Player } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locale";
import { formatSalary } from "@/lib/utils";
import { setPlayingThroughInjury } from "@/app/actions/roster";
import { PlayerAvatar } from "./PlayerAvatar";
import { ratingTone, toneClass } from "@/lib/color-scale";
import type { TradeRequestReason } from "@/lib/careers/player-demands";

// Vue d'ensemble scannable de l'effectif — avatar/nationalité/gabarit/stats
// de la saison. Le détail complet (les 10 attributs, contrat, historique,
// actions) vit sur la fiche du joueur (voir players/[playerId]/page.tsx).
export type RosterPlayer = Player & {
  salary: number;
  yearsRemaining: number;
  guaranteed: boolean;
  contractType: ContractType;
  wantsTrade: boolean;
  tradeReasons: TradeRequestReason[];
  ppg: number;
  rpg: number;
  apg: number;
};

type SortKey = "overallRating" | "age" | "heightCm" | "salary" | "yearsRemaining" | "ppg" | "rpg" | "apg";

// Composant client : ne peut pas appeler getTranslator() (server-only), donc
// tout le texte affiché arrive déjà traduit depuis le Server Component
// appelant (voir teams/[teamId]/page.tsx) — jamais de fonction `t` passée en
// prop à travers la frontière serveur/client, seulement des chaînes.
export interface RosterTableLabels {
  player: string;
  position: string;
  nationality: string;
  overall: string;
  height: string;
  age: string;
  salary: string;
  yearsRemaining: string;
  ppg: string;
  rpg: string;
  apg: string;
  unavailable: string;
  games: string;
  rest: string;
  playThroughInjury: string;
  wantsTrade: string;
  notGuaranteed: string;
  severity: Record<NonNullable<Player["injurySeverity"]>, string>;
  tradeReason: Record<TradeRequestReason, string>;
  contractType: Record<Exclude<ContractType, "standard">, string>;
}

function valueFor(player: RosterPlayer, key: SortKey): number {
  return player[key];
}

export function RosterTable({
  teamId,
  roster,
  canRelease = false,
  locale,
  labels,
}: {
  teamId: string;
  roster: RosterPlayer[];
  canRelease?: boolean;
  locale: Locale;
  labels: RosterTableLabels;
}) {
  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: "overallRating", label: labels.overall },
    { key: "heightCm", label: labels.height },
    { key: "age", label: labels.age },
    { key: "salary", label: labels.salary },
    { key: "yearsRemaining", label: labels.yearsRemaining },
    { key: "ppg", label: labels.ppg },
    { key: "rpg", label: labels.rpg },
    { key: "apg", label: labels.apg },
  ];
  const [sortKey, setSortKey] = useState<SortKey>("overallRating");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...roster];
    copy.sort((a, b) => {
      const diff = valueFor(a, sortKey) - valueFor(b, sortKey);
      return descending ? -diff : diff;
    });
    return copy;
  }, [roster, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="py-2 pr-3" />
            <th className="py-2 pr-3">{labels.player}</th>
            <th className="py-2 pr-3">{labels.position}</th>
            <th className="py-2 pr-3">{labels.nationality}</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="py-2 pr-3">
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={`uppercase tracking-[inherit] transition hover:text-fg ${
                    sortKey === col.key ? "text-accent-text" : ""
                  }`}
                >
                  {col.label}
                  {sortKey === col.key ? (descending ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.id} className="border-b border-line-soft">
              <td className="py-2 pr-3">
                <PlayerAvatar playerId={player.id} firstName={player.firstName} lastName={player.lastName} />
              </td>
              <td className="py-2 pr-3 font-medium">
                <Link href={`/teams/${teamId}/players/${player.id}`} className="whitespace-nowrap hover:underline">
                  #{player.jerseyNumber} {player.firstName} {player.lastName}
                </Link>
                {/* Badges sous le nom : en ligne, ils élargissaient la colonne et
                    poussaient les dernières colonnes hors du tableau. */}
                {(player.contractType !== "standard" || player.injured || player.wantsTrade) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {player.contractType !== "standard" && (
                      <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-normal text-info">
                        {labels.contractType[player.contractType]}
                      </span>
                    )}
                    {player.injured && (
                      <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs font-normal text-bad">
                        {labels.unavailable}{" "}
                        {player.injurySeverity ? `(${labels.severity[player.injurySeverity]}, ` : "("}
                        {player.injuryGamesRemaining} {labels.games})
                      </span>
                    )}
                    {player.injured && player.injurySeverity === "minor" && canRelease && (
                      <form action={setPlayingThroughInjury} className="inline">
                        <input type="hidden" name="playerId" value={player.id} />
                        <input type="hidden" name="value" value={player.playingThroughInjury ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded-full border border-line px-2 py-0.5 text-xs font-normal hover:bg-surface-2"
                        >
                          {player.playingThroughInjury ? labels.rest : labels.playThroughInjury}
                        </button>
                      </form>
                    )}
                    {player.wantsTrade && (
                      <span
                        title={player.tradeReasons.map((r) => labels.tradeReason[r]).join(" · ")}
                        className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-normal text-warn"
                      >
                        {labels.wantsTrade}
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td className="py-2 pr-3">{player.position}</td>
              <td className="py-2 pr-3">{player.nationality}</td>
              <td className={`py-2 pr-3 font-semibold ${toneClass(ratingTone(player.overallRating))}`}>
                {player.overallRating}
              </td>
              <td className="py-2 pr-3">{player.heightCm} cm</td>
              <td className="py-2 pr-3">{player.age}</td>
              <td className="whitespace-nowrap py-2 pr-3">
                {formatSalary(player.salary, locale)}
                {!player.guaranteed && (
                  <span className="block text-xs text-faint">
                    {labels.notGuaranteed}
                  </span>
                )}
              </td>
              <td className="py-2 pr-3">{player.yearsRemaining}</td>
              <td className="py-2 pr-3">{player.ppg}</td>
              <td className="py-2 pr-3">{player.rpg}</td>
              <td className="py-2 pr-3">{player.apg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

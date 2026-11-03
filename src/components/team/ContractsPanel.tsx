import Link from "next/link";
import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { NBA_SECOND_APRON, NBA_TAX_LINE } from "@/lib/careers/cap-rules";
import { formatSalary } from "@/lib/utils";
import { SortableTable } from "@/components/ui/SortableTable";

export interface ContractRow {
  playerId: string;
  name: string;
  position: string;
  contractType: string;
  salary: number;
  yearsRemaining: number;
  guaranteed: boolean;
}

export interface DeadCapRow {
  name: string;
  salary: number;
  yearsRemaining: number;
}

// Onglet « Contrats » de la page d'équipe : où en est la masse salariale
// par rapport aux seuils (plafond, et en NBA taxe de luxe et 2e apron),
// puis chaque contrat trié par salaire et l'argent mort.
export function ContractsPanel({
  teamId,
  leagueId,
  salaryCap,
  payroll,
  contracts,
  deadCap,
  t,
  locale,
}: {
  teamId: string;
  leagueId: string;
  salaryCap: number;
  payroll: number;
  contracts: ContractRow[];
  deadCap: DeadCapRow[];
  t: Translator;
  locale: Locale;
}) {
  const thresholds = [
    { label: t("team.contracts.salaryCap"), value: salaryCap },
    ...(leagueId === "nba"
      ? [
          { label: t("team.contracts.taxLine"), value: NBA_TAX_LINE },
          { label: t("team.contracts.secondApron"), value: NBA_SECOND_APRON },
        ]
      : []),
  ];
  const standard = contracts.filter((c) => c.contractType === "standard").sort((a, b) => b.salary - a.salary);
  const alternate = contracts.filter((c) => c.contractType !== "standard").sort((a, b) => b.salary - a.salary);

  const table = (rows: ContractRow[]) => (
    <div className="card overflow-x-auto px-4">
      <SortableTable
        initialSort={{ column: 2, descending: true }}
        columns={[
          { label: t("roster.column.player") },
          { label: t("roster.column.position") },
          { label: t("roster.column.salary"), align: "right", descendingFirst: true },
          { label: t("team.contracts.colYears"), align: "right", descendingFirst: true },
          { label: t("team.contracts.colGuaranteed") },
        ]}
        rows={rows.map((c) => ({
          key: c.playerId,
          sortValues: [c.name, c.position, c.salary, c.yearsRemaining, c.guaranteed ? 1 : 0],
          cells: [
            <Link key="name" href={`/teams/${teamId}/players/${c.playerId}`} className="font-medium hover:underline">
              {c.name}
            </Link>,
            <span key="pos" className="text-muted">{c.position}</span>,
            formatSalary(c.salary, locale),
            c.yearsRemaining,
            <span key="g" className={c.guaranteed ? "" : "text-warn"}>
              {c.guaranteed ? t("team.contracts.yes") : t("team.contracts.no")}
            </span>,
          ],
        }))}
      />
    </div>
  );

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="eyebrow mb-3">{t("team.contracts.thresholds")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {thresholds.map(({ label, value }) => {
            const diff = value - payroll;
            return (
              <div key={label} className="card px-4 py-3">
                <p className="eyebrow">{label}</p>
                <p className="mt-1 text-lg font-bold tabular">{formatSalary(value, locale)}</p>
                <p className={`text-xs ${diff >= 0 ? "text-good" : "text-bad"}`}>
                  {diff >= 0
                    ? t("team.contracts.room", { amount: formatSalary(diff, locale) })
                    : t("team.contracts.over", { amount: formatSalary(-diff, locale) })}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-3">
          {t("team.contracts.standard")} · {t("team.contracts.total")}{" "}
          {formatSalary(standard.reduce((sum, c) => sum + c.salary, 0), locale)}
        </h2>
        {table(standard)}
      </section>

      {alternate.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">{t("team.contracts.alternate")}</h2>
          {table(alternate)}
        </section>
      )}

      <section>
        <h2 className="eyebrow mb-3">
          {t("team.contracts.deadCap")} · {t("team.contracts.total")}{" "}
          {formatSalary(deadCap.reduce((sum, d) => sum + d.salary, 0), locale)}
        </h2>
        {deadCap.length === 0 ? (
          <p className="text-sm text-muted">{t("team.contracts.none")}</p>
        ) : (
          <div className="card overflow-x-auto px-4">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-4">{t("roster.column.player")}</th>
                  <th className="py-2 pr-4 text-right">{t("roster.column.salary")}</th>
                  <th className="py-2 text-right">{t("team.contracts.colYears")}</th>
                </tr>
              </thead>
              <tbody>
                {deadCap.map((d, i) => (
                  <tr key={`${d.name}-${i}`}>
                    <td className="py-2 pr-4">{d.name}</td>
                    <td className="py-2 pr-4 text-right">{formatSalary(d.salary, locale)}</td>
                    <td className="py-2 text-right">{d.yearsRemaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

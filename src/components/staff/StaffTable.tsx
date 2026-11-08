import type { StaffMemberView } from "@/lib/data-access/staff";
import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { STAFF_ROLES, renewalSalary, severanceCost, type StaffRole } from "@/lib/careers/staff-rules";
import { fireStaffAction, renewStaffAction } from "@/app/actions/staff";
import { formatSalary } from "@/lib/utils";

export function RatingBar({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-good" : value >= 50 ? "bg-accent" : value >= 35 ? "bg-warn" : "bg-bad";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
        <span className={`block h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(99, value))}%` }} />
      </span>
      <span className="w-6 text-right font-semibold tabular">{value}</span>
    </span>
  );
}

// Staff d'une équipe, groupé par rôle, avec les postes vacants. `manage` :
// boutons Licencier / Prolonger (mon équipe uniquement).
export function StaffTable({
  staff,
  slots,
  t,
  locale,
  manage,
}: {
  staff: StaffMemberView[];
  slots: Record<StaffRole, number>;
  t: Translator;
  locale: Locale;
  manage: boolean;
}) {
  return (
    <div className="space-y-5">
      {STAFF_ROLES.map((role) => {
        const members = staff.filter((m) => m.role === role);
        const vacancies = Math.max(0, slots[role] - members.length);
        return (
          <section key={role}>
            <h3 className="eyebrow mb-2">
              {t(`staff.rolePlural.${role}` as DictionaryKey)}{" "}
              <span className="font-normal text-faint">
                {members.length}/{slots[role]}
              </span>
            </h3>
            <div className="card divide-y divide-line-soft overflow-x-auto">
              {members.map((m) => (
                <div key={m.id} className="flex min-w-[640px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
                  <div className="w-48">
                    <p className="font-medium">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted">
                      {t("staff.col.age")} {m.age}
                      {m.specialty && <> · {t(`staff.specialty.${m.specialty}` as DictionaryKey)}</>}
                    </p>
                  </div>
                  <div className="w-24" title={t("staff.col.rating")}>
                    <RatingBar value={m.rating} />
                  </div>
                  <div className="w-24 text-xs text-muted">
                    {m.motivation !== null && (
                      <>
                        {t("staff.col.motivation")} <span className="font-semibold text-fg tabular">{m.motivation}</span>
                      </>
                    )}
                  </div>
                  <div className="w-24 tabular">{formatSalary(m.salary, locale)}</div>
                  <div className={`w-16 text-xs tabular ${m.yearsRemaining <= 1 ? "text-warn" : "text-muted"}`}>
                    {t("staff.years", { count: m.yearsRemaining })}
                  </div>
                  {manage && (
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {m.yearsRemaining <= 1 && (
                        <form action={renewStaffAction} className="flex items-center gap-1">
                          <input type="hidden" name="staffId" value={m.id} />
                          <select name="years" defaultValue="2" className="field px-1.5 py-1 text-xs">
                            {[1, 2, 3].map((y) => (
                              <option key={y} value={y}>
                                +{t("staff.yearsShort", { count: y })}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            title={t("staff.renewFor", { amount: formatSalary(renewalSalary(m.salary, m.rating), locale) })}
                            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                          >
                            {t("staff.renew")} · {formatSalary(renewalSalary(m.salary, m.rating), locale)}
                          </button>
                        </form>
                      )}
                      <form action={fireStaffAction}>
                        <input type="hidden" name="staffId" value={m.id} />
                        <button
                          type="submit"
                          title={t("staff.fireConfirm", { amount: formatSalary(severanceCost(m.salary, m.yearsRemaining), locale) })}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-bad hover:bg-bad/10"
                        >
                          {t("staff.fire")} · {formatSalary(severanceCost(m.salary, m.yearsRemaining), locale)}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
              {Array.from({ length: vacancies }).map((_, i) => (
                <div key={`vacant-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-warn">{t("staff.vacant")}</span>
                  {manage && (
                    <a href={`/staff?role=${role}#market`} className="text-xs font-medium text-accent-text hover:underline">
                      {t("staff.recruit")} →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

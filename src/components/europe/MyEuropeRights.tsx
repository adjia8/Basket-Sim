import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import { formatSalary } from "@/lib/utils";

// Joueurs dont mon équipe détient les droits sans contrat NBA : draftés et
// laissés en Europe (draft-and-stash), ou rachetés et pas encore signés.
export async function MyEuropeRights({ careerId, teamId, t, locale }: { careerId: string; teamId: string; t: Translator; locale: Locale }) {
  const states = await prisma.playerState.findMany({
    where: { careerId, rightsTeamId: teamId, retired: false },
    include: { player: { select: { firstName: true, lastName: true, position: true } } },
    orderBy: { overallRating: "desc" },
  });
  const signed = new Set(
    (await prisma.contract.findMany({ where: { careerId, playerId: { in: states.map((s) => s.playerId) } }, select: { playerId: true } })).map((c) => c.playerId)
  );
  const rows = states.filter((s) => !signed.has(s.playerId));
  if (rows.length === 0) return null;
  return (
    <section className="mt-6" data-testid="my-europe-rights">
      <h2 className="eyebrow mb-1">{t("europe.rightsTitle")}</h2>
      <p className="mb-3 text-xs text-muted">{t("europe.rightsHint")}</p>
      <ul className="card divide-y divide-line">
        {rows.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <span>
              <Link href={`/teams/${teamId}/players/${s.playerId}`} className="font-medium hover:underline">
                {s.player.firstName} {s.player.lastName}
              </Link>{" "}
              <span className="text-muted">
                ({s.player.position}, {s.overallRating}, {t("tradeReview.age", { age: s.age })})
              </span>
            </span>
            <span className="text-xs text-soft">
              {s.abroadClub
                ? `${s.abroadClub} · ${t("europe.buyout", { amount: formatSalary(s.buyout, locale) })}`
                : t("europe.readyToSign")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

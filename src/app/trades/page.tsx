import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTeamById } from "@/lib/data-access/teams";
import { isTradeDeadlinePassed } from "@/lib/data-access/season-windows";
import { cancelTradeOffer, respondToTradeOffer } from "@/app/actions/trade";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

export default async function TradesPage() {
  const membership = await getCurrentMembership();
  const { t } = await getTranslator();

  const [received, sent, tradeDeadlinePassed] = await Promise.all([
    prisma.tradeOffer.findMany({
      where: { careerId: membership.careerId, toTeamId: membership.teamId, status: "pending" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tradeOffer.findMany({
      where: { careerId: membership.careerId, fromTeamId: membership.teamId, status: "pending" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    isTradeDeadlinePassed(membership.careerId, membership.season),
  ]);

  const allOffers = [...received, ...sent];
  const playerIds = [
    ...new Set(allOffers.flatMap((o) => o.items.map((i) => i.playerId).filter((id): id is string => Boolean(id)))),
  ];
  const pickIds = [
    ...new Set(
      allOffers.flatMap((o) => o.items.map((i) => i.draftPickId).filter((id): id is string => Boolean(id)))
    ),
  ];
  const teamIds = [...new Set(allOffers.flatMap((o) => [o.fromTeamId, o.toTeamId]))];

  const [players, picks, teamRows] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, include: { originalTeam: true } }),
    Promise.all(teamIds.map((id) => getTeamById(id))),
  ]);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const pickById = new Map(picks.map((p) => [p.id, p]));
  const teamById = new Map<string, Team>(
    teamRows.filter((t): t is Team => Boolean(t)).map((t) => [t.id, t])
  );

  // side "from" = l'équipe qui propose (offer.fromTeamId), "to" = l'équipe
  // qui recevrait (offer.toTeamId) — sert à construire le lien vers la fiche
  // de chaque joueur listé dans cette moitié de l'échange.
  function assetLabels(t: Translator, offer: (typeof allOffers)[number], side: "from" | "to") {
    const teamId = side === "from" ? offer.fromTeamId : offer.toTeamId;
    const items = offer.items.filter((i) => i.side === side);
    const playerNodes = items
      .map((i) => (i.playerId ? playerById.get(i.playerId) : undefined))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => (
        <Link key={p.id} href={`/teams/${teamId}/players/${p.id}`} className="hover:underline">
          {p.firstName} {p.lastName}
        </Link>
      ));
    const pickLabels = items
      .map((i) => (i.draftPickId ? pickById.get(i.draftPickId) : undefined))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) =>
        p.pickNumber !== null
          ? t("common.draftPick.full", { number: p.pickNumber, round: p.round, season: p.season }) +
            t("common.draftPick.via", { abbr: p.originalTeam.abbreviation })
          : t("common.draftPick.roundOnly", { round: p.round, season: p.season }) +
            ` (${p.originalTeam.abbreviation})`
      );
    const nodes: ReactNode[] = [...playerNodes, ...pickLabels];
    return nodes.map((node, i) => (
      <span key={i}>
        {node}
        {i < nodes.length - 1 && ", "}
      </span>
    ));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("tradeOffers.title")}</h1>

      {tradeDeadlinePassed && (
        <p className="mt-4 text-sm text-red-500">{t("tradeOffers.deadlinePassedNotice")}</p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("tradeOffers.received")}</h2>
        {received.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">{t("tradeOffers.noneePending")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {received.map((offer) => {
              const fromTeam = teamById.get(offer.fromTeamId);
              return (
                <div key={offer.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <p className="text-sm">
                    <span className="font-medium">
                      {fromTeam ? (
                        <Link href={`/teams/${fromTeam.id}`} className="hover:underline">
                          {teamFullName(fromTeam)}
                        </Link>
                      ) : (
                        "?"
                      )}
                    </span>{" "}
                    {t("tradeOffers.proposesVerb")} <strong>{assetLabels(t, offer, "from")}</strong>{" "}
                    {t("tradeOffers.forVerb")} <strong>{assetLabels(t, offer, "to")}</strong>
                  </p>
                  <div className="mt-3 flex gap-2">
                    {!tradeDeadlinePassed && (
                      <form action={respondToTradeOffer}>
                        <input type="hidden" name="tradeOfferId" value={offer.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <button
                          type="submit"
                          className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                        >
                          {t("tradeOffers.accept")}
                        </button>
                      </form>
                    )}
                    <form action={respondToTradeOffer}>
                      <input type="hidden" name="tradeOfferId" value={offer.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button
                        type="submit"
                        className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                      >
                        {t("tradeOffers.reject")}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("tradeOffers.sent")}</h2>
        {sent.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">{t("tradeOffers.noneePending")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((offer) => {
              const toTeam = teamById.get(offer.toTeamId);
              return (
                <div key={offer.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <p className="text-sm">
                    {t("tradeOffers.sentToPrefix")}{" "}
                    {toTeam ? (
                      <Link href={`/teams/${toTeam.id}`} className="hover:underline">
                        {teamFullName(toTeam)}
                      </Link>
                    ) : (
                      "?"
                    )}
                    : <strong>{assetLabels(t, offer, "from")}</strong> {t("tradeOffers.forVerb")}{" "}
                    <strong>{assetLabels(t, offer, "to")}</strong>
                  </p>
                  <form action={cancelTradeOffer} className="mt-3">
                    <input type="hidden" name="tradeOfferId" value={offer.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                    >
                      {t("tradeOffers.cancel")}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

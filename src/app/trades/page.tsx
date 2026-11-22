import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTeamById } from "@/lib/data-access/teams";
import { getTradeDeadlineInfo } from "@/lib/data-access/season-windows";
import { TradeDeadlineNotice } from "@/components/team/TradeDeadlineNotice";
import { cancelTradeOffer, respondToTradeOffer } from "@/app/actions/trade";
import { getTranslator, type Translator } from "@/lib/i18n/translate";
import { teamFullName } from "@/lib/utils";
import { getTeamsByLeague } from "@/lib/data-access/teams";
import { getStandings } from "@/lib/data-access/standings";
import { getCareerExpectations } from "@/lib/data-access/expectations";
import { NEGOTIATION_MAX_COUNTERS, teamOutlook } from "@/lib/careers/trade-rules";
import { winPctForStandings } from "@/lib/careers/player-demands";
import type { DictionaryKey } from "@/lib/i18n/dictionary";
import { getOfferDetails } from "@/lib/data-access/trade-review";
import { TradeOfferDetail } from "@/components/trades/TradeOfferDetail";

const OUTLOOK_TONE: Record<string, string> = {
  rebuild: "bg-info/15 text-info",
  middle: "bg-surface-3 text-soft",
  contender: "bg-accent/15 text-accent-text",
};
import type { Team } from "@/lib/types";

export default async function TradesPage() {
  const membership = await getCurrentMembership();
  const { t, locale } = await getTranslator();

  const [received, sent, deadlineInfo] = await Promise.all([
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
    getTradeDeadlineInfo(membership.careerId, membership.season),
  ]);
  const tradeDeadlinePassed = deadlineInfo.passed;

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
  // Détail (âge, poste, stats, contrat) et avis de l'adjoint sur les offres reçues.
  const details = await getOfferDetails(
    membership.careerId,
    membership.teamId,
    membership.leagueId,
    membership.season,
    allOffers,
    (o) => o.toTeamId === membership.teamId
  );
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

  // Partenaires possibles (autres équipes) avec leur profil d'échange.
  const [leagueTeams, standings, expectations] = await Promise.all([
    getTeamsByLeague(membership.leagueId),
    getStandings(membership.careerId, membership.leagueId, membership.season),
    getCareerExpectations(membership.careerId, membership.leagueId),
  ]);
  const partners = leagueTeams
    .filter((team) => team.id !== membership.teamId)
    .map((team) => {
      const row = standings.find((r) => r.teamId === team.id);
      const wins = row?.wins ?? 0;
      const losses = row?.losses ?? 0;
      return {
        team,
        record: `${wins}-${losses}`,
        outlook: teamOutlook({ winPct: winPctForStandings(wins, losses), gamesPlayed: wins + losses, expectation: expectations.get(team.id) ?? null }),
      };
    })
    .sort((a, b) => teamFullName(a.team).localeCompare(teamFullName(b.team)));

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("tradeOffers.title")}</h1>

      {tradeDeadlinePassed && (
        <p className="mt-4 text-sm text-bad">{t("tradeOffers.deadlinePassedNotice")}</p>
      )}
      <TradeDeadlineNotice info={deadlineInfo} t={t} locale={locale} className="mt-4" />

      {/* Lancer un échange : chaque équipe avec son profil (ce qu'elle
          recherche), pour cibler le bon partenaire. */}
      {!tradeDeadlinePassed && (
        <section className="mt-8" data-testid="trade-partners">
          <h2 className="text-lg font-semibold">{t("tradeOffers.newTrade")}</h2>
          <p className="mt-1 text-sm text-muted">{t("tradeOffers.newTradeHint")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <Link
                key={p.team.id}
                href={`/teams/${p.team.id}?tab=trade`}
                className="card flex items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{teamFullName(p.team)}</span>
                  <span className="text-xs text-faint tabular">{p.record}</span>
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${OUTLOOK_TONE[p.outlook]}`}>
                  {t(`trade.outlook.${p.outlook}` as DictionaryKey)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("tradeOffers.received")}</h2>
        {received.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("tradeOffers.noneePending")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {received.map((offer) => {
              const fromTeam = teamById.get(offer.fromTeamId);
              return (
                <div key={offer.id} className="card p-4" data-testid="received-offer">
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
                  {details.get(offer.id) && <TradeOfferDetail detail={details.get(offer.id)!} t={t} locale={locale} />}
                  {offer.counterAttempts > 0 && (
                    <p className="mt-2 text-xs text-warn">
                      {t("tradeOffers.counterAttempts", { n: offer.counterAttempts, max: NEGOTIATION_MAX_COUNTERS })}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!tradeDeadlinePassed && (
                      <form action={respondToTradeOffer}>
                        <input type="hidden" name="tradeOfferId" value={offer.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <button
                          type="submit"
                          className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-fg transition hover:bg-accent-hover"
                        >
                          {t("tradeOffers.accept")}
                        </button>
                      </form>
                    )}
                    {!tradeDeadlinePassed && (
                      <Link
                        href={`/teams/${offer.fromTeamId}?tab=trade&counter=${offer.id}`}
                        title={t("tradeOffers.negotiateHint")}
                        className="rounded-md border border-accent/50 px-4 py-1.5 text-xs font-medium text-accent-text transition hover:bg-accent/10"
                        data-testid="negotiate-offer"
                      >
                        {t("tradeOffers.negotiate")}
                      </Link>
                    )}
                    <form action={respondToTradeOffer}>
                      <input type="hidden" name="tradeOfferId" value={offer.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button
                        type="submit"
                        className="rounded-md bg-surface-2 px-4 py-1.5 text-xs font-medium transition hover:bg-surface-3"
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
          <p className="mt-2 text-sm text-muted">{t("tradeOffers.noneePending")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((offer) => {
              const toTeam = teamById.get(offer.toTeamId);
              return (
                <div key={offer.id} className="card p-4">
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
                  {details.get(offer.id) && <TradeOfferDetail detail={details.get(offer.id)!} t={t} locale={locale} />}
                  <form action={cancelTradeOffer} className="mt-3">
                    <input type="hidden" name="tradeOfferId" value={offer.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-surface-2 px-4 py-1.5 text-xs font-medium transition hover:bg-surface-3"
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

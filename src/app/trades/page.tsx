import { getCurrentMembership } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { getTeamById } from "@/lib/data-access/teams";
import { cancelTradeOffer, respondToTradeOffer } from "@/app/actions/trade";
import { teamFullName } from "@/lib/utils";
import type { Team } from "@/lib/types";

export default async function TradesPage() {
  const membership = await getCurrentMembership();

  const [received, sent] = await Promise.all([
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
  ]);

  const allOffers = [...received, ...sent];
  const playerIds = [...new Set(allOffers.flatMap((o) => o.items.map((i) => i.playerId)))];
  const teamIds = [...new Set(allOffers.flatMap((o) => [o.fromTeamId, o.toTeamId]))];

  const [players, teamRows] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } } }),
    Promise.all(teamIds.map((id) => getTeamById(id))),
  ]);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map<string, Team>(
    teamRows.filter((t): t is Team => Boolean(t)).map((t) => [t.id, t])
  );

  function playerNames(offer: (typeof allOffers)[number], side: "from" | "to") {
    return offer.items
      .filter((i) => i.side === side)
      .map((i) => playerById.get(i.playerId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => `${p.firstName} ${p.lastName}`)
      .join(", ");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Échanges</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Propositions reçues</h2>
        {received.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Aucune proposition en attente.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {received.map((offer) => {
              const fromTeam = teamById.get(offer.fromTeamId);
              return (
                <div key={offer.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <p className="text-sm">
                    <span className="font-medium">{fromTeam ? teamFullName(fromTeam) : "?"}</span>{" "}
                    propose <strong>{playerNames(offer, "from")}</strong> contre{" "}
                    <strong>{playerNames(offer, "to")}</strong>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <form action={respondToTradeOffer}>
                      <input type="hidden" name="tradeOfferId" value={offer.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <button
                        type="submit"
                        className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                      >
                        Accepter
                      </button>
                    </form>
                    <form action={respondToTradeOffer}>
                      <input type="hidden" name="tradeOfferId" value={offer.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button
                        type="submit"
                        className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                      >
                        Refuser
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
        <h2 className="text-lg font-semibold">Propositions envoyées</h2>
        {sent.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Aucune proposition en attente.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((offer) => {
              const toTeam = teamById.get(offer.toTeamId);
              return (
                <div key={offer.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <p className="text-sm">
                    À <span className="font-medium">{toTeam ? teamFullName(toTeam) : "?"}</span> :{" "}
                    <strong>{playerNames(offer, "from")}</strong> contre{" "}
                    <strong>{playerNames(offer, "to")}</strong>
                  </p>
                  <form action={cancelTradeOffer} className="mt-3">
                    <input type="hidden" name="tradeOfferId" value={offer.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-black/5 px-4 py-1.5 text-xs font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                    >
                      Annuler
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

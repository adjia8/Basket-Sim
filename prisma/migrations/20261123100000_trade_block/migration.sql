-- Joueur mis sur le marché par son GM : les équipes IA font des offres
-- (voir ai-trades.ts, solicitOffersForBlock).
ALTER TABLE "PlayerState" ADD COLUMN "onTradeBlock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerState" ADD COLUMN "tradeBlockSince" TIMESTAMP(3);

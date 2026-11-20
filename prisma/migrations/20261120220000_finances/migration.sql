ALTER TABLE "TeamState" ADD COLUMN "ticketPriceLevel" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "TeamState" ADD COLUMN "concessionPriceLevel" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "TeamState" ADD COLUMN "arenaLevel" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "TeamState" ADD COLUMN "financeLedgerJson" TEXT;
-- Passage des trésoreries à l'échelle réelle (l'ancien modèle comptait ≈ 4 M$
-- de revenu par saison, le nouveau ≈ 400 M$) : ×20 pour garder un ordre de
-- grandeur cohérent avec les nouveaux montants de départ (40-120 M$).
UPDATE "TeamState" SET "finances" = "finances" * 20;

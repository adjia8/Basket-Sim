-- Négociation d'une offre reçue : contre-propositions refusées par l'équipe
-- qui a fait l'offre (au-delà de la limite, elle rompt les négociations).
ALTER TABLE "TradeOffer" ADD COLUMN "counterAttempts" INTEGER NOT NULL DEFAULT 0;

-- Demande d'installation d'un joueur (centre médical, récupération…) et
-- promesse du GM — voir facility-request-rules.ts.
ALTER TABLE "PlayerState" ADD COLUMN "facilityRequestKey" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "facilityRequestTier" INTEGER;
ALTER TABLE "PlayerState" ADD COLUMN "facilityPromiseBy" TIMESTAMP(3);

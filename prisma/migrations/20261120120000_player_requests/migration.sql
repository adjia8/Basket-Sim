ALTER TABLE "PlayerState" ADD COLUMN "pendingRequest" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "requestAt" TIMESTAMP(3);
ALTER TABLE "PlayerState" ADD COLUMN "lastRequestAt" TIMESTAMP(3);
ALTER TABLE "TeamState" ADD COLUMN "lastPlayerRequestAt" TIMESTAMP(3);

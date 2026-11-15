ALTER TABLE "GmProfile" ADD COLUMN "boardObjectivesJson" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "promisedStatus" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "promiseSince" TIMESTAMP(3);

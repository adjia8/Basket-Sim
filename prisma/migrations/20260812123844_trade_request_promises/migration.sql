-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "lastExtendedSeason" TEXT;
-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "activePromiseSeason" TEXT,
ADD COLUMN     "activePromiseType" TEXT,
ADD COLUMN     "lastTradeRequestCheckDate" TIMESTAMP(3),
ADD COLUMN     "promiseOriginTeamId" TEXT,
ADD COLUMN     "tradeRequestReasonsJson" TEXT,
ADD COLUMN     "tradeRequestSinceSeason" TEXT,
ADD COLUMN     "wantsTrade" BOOLEAN NOT NULL DEFAULT false;
-- AlterTable
ALTER TABLE "TeamState" ADD COLUMN     "lastTradeRequestDate" TIMESTAMP(3);

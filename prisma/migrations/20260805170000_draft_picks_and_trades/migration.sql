-- DropIndex
DROP INDEX "DraftPick_careerId_season_pickNumber_key";

-- AlterTable
ALTER TABLE "DraftPick" ADD COLUMN     "originalTeamId" TEXT NOT NULL,
ALTER COLUMN "pickNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TradeOfferItem" ADD COLUMN     "draftPickId" TEXT,
ALTER COLUMN "playerId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_careerId_season_round_originalTeamId_key" ON "DraftPick"("careerId", "season", "round", "originalTeamId");

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_originalTeamId_fkey" FOREIGN KEY ("originalTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


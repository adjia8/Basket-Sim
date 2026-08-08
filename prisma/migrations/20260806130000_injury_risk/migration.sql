-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "injuryRisk" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "injured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "injuryGamesRemaining" INTEGER NOT NULL DEFAULT 0;


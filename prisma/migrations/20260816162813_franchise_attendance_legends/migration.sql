-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "hallOfFameTeamId" TEXT;

-- AlterTable
ALTER TABLE "TeamState" ADD COLUMN     "attendance" INTEGER NOT NULL DEFAULT 50;


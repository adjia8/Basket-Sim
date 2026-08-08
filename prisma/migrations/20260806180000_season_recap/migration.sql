-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "hallOfFame" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "peakOverallRating" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "peakRenown" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "retiredSeason" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "scoutingNote" TEXT;


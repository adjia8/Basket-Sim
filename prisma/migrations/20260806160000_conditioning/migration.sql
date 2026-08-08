-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "conditioning" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "injurySeverity" TEXT,
ADD COLUMN     "playingThroughInjury" BOOLEAN NOT NULL DEFAULT false;


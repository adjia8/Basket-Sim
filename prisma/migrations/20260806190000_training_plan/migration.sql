-- AlterTable
ALTER TABLE "PlayerState" ADD COLUMN     "trainingBoost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trainingBoostFocus" TEXT;

-- AlterTable
ALTER TABLE "TeamState" ADD COLUMN     "trainingFocus" TEXT,
ADD COLUMN     "trainingIntensity" TEXT NOT NULL DEFAULT 'medium';


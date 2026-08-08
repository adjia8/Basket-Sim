-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "contractType" TEXT NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT 'États-Unis';

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT 'États-Unis';

-- CreateTable
CREATE TABLE "PlayerTeamStint" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerTeamStint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerTeamStint_careerId_playerId_idx" ON "PlayerTeamStint"("careerId", "playerId");

-- AddForeignKey
ALTER TABLE "PlayerTeamStint" ADD CONSTRAINT "PlayerTeamStint_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTeamStint" ADD CONSTRAINT "PlayerTeamStint_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTeamStint" ADD CONSTRAINT "PlayerTeamStint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

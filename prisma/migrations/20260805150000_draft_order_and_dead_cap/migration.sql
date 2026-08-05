-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "guaranteed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "draftedPlayerId" TEXT,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadCap" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "yearsRemaining" INTEGER NOT NULL,

    CONSTRAINT "DeadCap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftPick_careerId_season_status_idx" ON "DraftPick"("careerId", "season", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_careerId_season_pickNumber_key" ON "DraftPick"("careerId", "season", "pickNumber");

-- CreateIndex
CREATE INDEX "DeadCap_careerId_teamId_idx" ON "DeadCap"("careerId", "teamId");

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadCap" ADD CONSTRAINT "DeadCap_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadCap" ADD CONSTRAINT "DeadCap_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


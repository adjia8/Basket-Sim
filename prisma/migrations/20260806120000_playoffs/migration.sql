-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "gameNumber" INTEGER,
ADD COLUMN     "playoffSeriesId" TEXT;

-- CreateTable
CREATE TABLE "PlayoffSeries" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "conference" TEXT,
    "round" TEXT NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "homeSeed" INTEGER NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awaySeed" INTEGER NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeWins" INTEGER NOT NULL DEFAULT 0,
    "awayWins" INTEGER NOT NULL DEFAULT 0,
    "winnerTeamId" TEXT,

    CONSTRAINT "PlayoffSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayoffSeries_careerId_season_idx" ON "PlayoffSeries"("careerId", "season");

-- CreateIndex
CREATE INDEX "Game_playoffSeriesId_idx" ON "Game"("playoffSeriesId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playoffSeriesId_fkey" FOREIGN KEY ("playoffSeriesId") REFERENCES "PlayoffSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


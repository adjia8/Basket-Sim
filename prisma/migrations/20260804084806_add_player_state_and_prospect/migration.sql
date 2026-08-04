-- CreateTable
CREATE TABLE "PlayerState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "scoring" INTEGER NOT NULL,
    "playmaking" INTEGER NOT NULL,
    "rebounding" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "athleticism" INTEGER NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlayerState_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "careerId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "age" INTEGER NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "scoring" INTEGER NOT NULL,
    "playmaking" INTEGER NOT NULL,
    "rebounding" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "athleticism" INTEGER NOT NULL,
    CONSTRAINT "Prospect_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prospect_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlayerState_careerId_idx" ON "PlayerState"("careerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerState_careerId_playerId_key" ON "PlayerState"("careerId", "playerId");

-- CreateIndex
CREATE INDEX "Prospect_careerId_idx" ON "Prospect"("careerId");

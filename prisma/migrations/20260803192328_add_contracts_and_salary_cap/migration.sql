/*
  Warnings:

  - Added the required column `salaryCap` to the `League` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "yearsRemaining" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contract_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "salaryCap" INTEGER NOT NULL
);
INSERT INTO "new_League" ("code", "id", "name", "season") SELECT "code", "id", "name", "season" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Contract_careerId_idx" ON "Contract"("careerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_careerId_playerId_key" ON "Contract"("careerId", "playerId");

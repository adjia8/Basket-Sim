-- Médical et entraînement façon Football Manager : usure (fatigue de fond),
-- repos programmé (gestion de la charge), type de blessure nommé,
-- entraînement individuel, et historique médical.
ALTER TABLE "PlayerState" ADD COLUMN "wear" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerState" ADD COLUMN "restNextGame" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlayerState" ADD COLUMN "injuryType" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "individualFocus" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "developmentProgress" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "InjuryRecord" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "injuryType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "gamesOut" INTEGER NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InjuryRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InjuryRecord_careerId_playerId_idx" ON "InjuryRecord"("careerId", "playerId");
CREATE INDEX "InjuryRecord_careerId_teamId_idx" ON "InjuryRecord"("careerId", "teamId");
ALTER TABLE "InjuryRecord" ADD CONSTRAINT "InjuryRecord_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

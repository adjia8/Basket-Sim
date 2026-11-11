-- Statistiques de saison, trophées et actualité de la ligue.
CREATE TABLE "PlayerSeasonStat" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rebounds" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "steals" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 0,
    "turnovers" INTEGER NOT NULL DEFAULT 0,
    "fgm" INTEGER NOT NULL DEFAULT 0,
    "fga" INTEGER NOT NULL DEFAULT 0,
    "tpm" INTEGER NOT NULL DEFAULT 0,
    "tpa" INTEGER NOT NULL DEFAULT 0,
    "ftm" INTEGER NOT NULL DEFAULT 0,
    "fta" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerSeasonStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlayerSeasonStat_careerId_season_playerId_key" ON "PlayerSeasonStat"("careerId", "season", "playerId");
CREATE INDEX "PlayerSeasonStat_careerId_season_idx" ON "PlayerSeasonStat"("careerId", "season");
ALTER TABLE "PlayerSeasonStat" ADD CONSTRAINT "PlayerSeasonStat_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "playerId" TEXT,
    "teamId" TEXT NOT NULL,
    "staffId" TEXT,
    "label" TEXT,
    "statLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Award_careerId_season_idx" ON "Award"("careerId", "season");
CREATE INDEX "Award_careerId_playerId_idx" ON "Award"("careerId", "playerId");
ALTER TABLE "Award" ADD CONSTRAINT "Award_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeagueNews" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueNews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeagueNews_careerId_createdAt_idx" ON "LeagueNews"("careerId", "createdAt");
ALTER TABLE "LeagueNews" ADD CONSTRAINT "LeagueNews_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

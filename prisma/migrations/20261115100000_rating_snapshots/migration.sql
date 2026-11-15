CREATE TABLE "PlayerRatingSnapshot" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "overall" INTEGER NOT NULL,
    CONSTRAINT "PlayerRatingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlayerRatingSnapshot_careerId_playerId_date_key" ON "PlayerRatingSnapshot"("careerId", "playerId", "date");
CREATE INDEX "PlayerRatingSnapshot_careerId_playerId_idx" ON "PlayerRatingSnapshot"("careerId", "playerId");
CREATE INDEX "PlayerRatingSnapshot_careerId_date_idx" ON "PlayerRatingSnapshot"("careerId", "date");
ALTER TABLE "PlayerRatingSnapshot" ADD CONSTRAINT "PlayerRatingSnapshot_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

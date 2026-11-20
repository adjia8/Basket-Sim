CREATE TABLE "ProspectInterview" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectInterview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProspectInterview_careerId_teamId_prospectId_key" ON "ProspectInterview"("careerId", "teamId", "prospectId");
CREATE INDEX "ProspectInterview_careerId_teamId_season_idx" ON "ProspectInterview"("careerId", "teamId", "season");
ALTER TABLE "ProspectInterview" ADD CONSTRAINT "ProspectInterview_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GmProfile" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "offensePoints" INTEGER NOT NULL,
    "defensePoints" INTEGER NOT NULL,
    "physicalPoints" INTEGER NOT NULL,
    "tacticalPoints" INTEGER NOT NULL,
    "chemistryPoints" INTEGER NOT NULL,
    "hiredSeason" TEXT NOT NULL,
    "currentExpectationTier" TEXT NOT NULL,
    "warningsAtCurrentTeam" INTEGER NOT NULL DEFAULT 0,
    "pendingReassignment" BOOLEAN NOT NULL DEFAULT false,
    "pendingOfferTeamId" TEXT,
    CONSTRAINT "GmProfile_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "GmSeasonRecord" (
    "id" TEXT NOT NULL,
    "gmProfileId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "expectationTier" TEXT NOT NULL,
    "resultTier" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GmSeasonRecord_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "GmProfile_membershipId_key" ON "GmProfile"("membershipId");
-- CreateIndex
CREATE INDEX "GmSeasonRecord_gmProfileId_idx" ON "GmSeasonRecord"("gmProfileId");
-- AddForeignKey
ALTER TABLE "GmProfile" ADD CONSTRAINT "GmProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "GmSeasonRecord" ADD CONSTRAINT "GmSeasonRecord_gmProfileId_fkey" FOREIGN KEY ("gmProfileId") REFERENCES "GmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

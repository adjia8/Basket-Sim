-- Staff façon Football Manager : membres du staff, budget alloué par les propriétaires.
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "teamId" TEXT,
    "role" TEXT NOT NULL,
    "specialty" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "motivation" INTEGER,
    "salary" INTEGER NOT NULL,
    "yearsRemaining" INTEGER NOT NULL DEFAULT 0,
    "hiredSeason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffMember_careerId_teamId_idx" ON "StaffMember"("careerId", "teamId");
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamState" ADD COLUMN "staffBudget" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeamState" ADD COLUMN "staffSeverance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TeamState" ADD COLUMN "staffBudgetRequestSeason" TEXT;

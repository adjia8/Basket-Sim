-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "optionType" TEXT;
ALTER TABLE "Contract" ADD COLUMN "optionDeclined" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ContractNegotiation" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "patienceLeft" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "counterSalary" INTEGER,
    "counterYears" INTEGER,
    "counterOption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "walkedGameDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractNegotiation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractNegotiation_careerId_playerId_teamId_key" ON "ContractNegotiation"("careerId", "playerId", "teamId");
CREATE INDEX "ContractNegotiation_careerId_idx" ON "ContractNegotiation"("careerId");
ALTER TABLE "ContractNegotiation" ADD CONSTRAINT "ContractNegotiation_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

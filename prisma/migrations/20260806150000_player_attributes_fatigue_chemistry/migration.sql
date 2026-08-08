-- AlterTable
ALTER TABLE "Player" DROP COLUMN "defense",
DROP COLUMN "scoring",
ADD COLUMN     "basketballIQ" INTEGER NOT NULL,
ADD COLUMN     "clutch" INTEGER NOT NULL,
ADD COLUMN     "defenseInside" INTEGER NOT NULL,
ADD COLUMN     "defenseOutside" INTEGER NOT NULL,
ADD COLUMN     "scoringInside" INTEGER NOT NULL,
ADD COLUMN     "scoringOutside" INTEGER NOT NULL,
ADD COLUMN     "stamina" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PlayerState" DROP COLUMN "defense",
DROP COLUMN "scoring",
ADD COLUMN     "basketballIQ" INTEGER NOT NULL,
ADD COLUMN     "clutch" INTEGER NOT NULL,
ADD COLUMN     "defenseInside" INTEGER NOT NULL,
ADD COLUMN     "defenseOutside" INTEGER NOT NULL,
ADD COLUMN     "fatigue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoringInside" INTEGER NOT NULL,
ADD COLUMN     "scoringOutside" INTEGER NOT NULL,
ADD COLUMN     "stamina" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Prospect" DROP COLUMN "defense",
DROP COLUMN "scoring",
ADD COLUMN     "basketballIQ" INTEGER NOT NULL,
ADD COLUMN     "clutch" INTEGER NOT NULL,
ADD COLUMN     "defenseInside" INTEGER NOT NULL,
ADD COLUMN     "defenseOutside" INTEGER NOT NULL,
ADD COLUMN     "scoringInside" INTEGER NOT NULL,
ADD COLUMN     "scoringOutside" INTEGER NOT NULL,
ADD COLUMN     "stamina" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "TeamState" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "chemistry" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "TeamState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamState_careerId_teamId_key" ON "TeamState"("careerId", "teamId");

-- AddForeignKey
ALTER TABLE "TeamState" ADD CONSTRAINT "TeamState_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamState" ADD CONSTRAINT "TeamState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


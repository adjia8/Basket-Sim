-- AlterTable
ALTER TABLE "GmProfile" ADD COLUMN     "frontOfficeApproval" INTEGER NOT NULL DEFAULT 50;
-- AlterTable
ALTER TABLE "TeamState" ADD COLUMN     "lastPressConferenceDate" TIMESTAMP(3),
ADD COLUMN     "morale" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "publicOpinion" INTEGER NOT NULL DEFAULT 50;
-- CreateTable
CREATE TABLE "PressConference" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PressConference_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PressQuestion" (
    "id" TEXT NOT NULL,
    "pressConferenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "chosenOptionId" TEXT,
    CONSTRAINT "PressQuestion_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PressConference_careerId_teamId_idx" ON "PressConference"("careerId", "teamId");
-- AddForeignKey
ALTER TABLE "PressConference" ADD CONSTRAINT "PressConference_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PressQuestion" ADD CONSTRAINT "PressQuestion_pressConferenceId_fkey" FOREIGN KEY ("pressConferenceId") REFERENCES "PressConference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

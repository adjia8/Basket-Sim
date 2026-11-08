-- Refonte des conférences de presse façon Football Manager.
ALTER TABLE "PlayerState" ADD COLUMN "morale" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "TeamState" ADD COLUMN "refereeCriticisms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PressConference" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'postgame';
ALTER TABLE "PressConference" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PressConference" ADD COLUMN "headline" TEXT;
ALTER TABLE "PressConference" ADD COLUMN "answeredAt" TIMESTAMP(3);
ALTER TABLE "PressQuestion" ADD COLUMN "journalist" TEXT;
ALTER TABLE "PressQuestion" ADD COLUMN "outlet" TEXT;
ALTER TABLE "PressQuestion" ADD COLUMN "topic" TEXT;
ALTER TABLE "PressQuestion" ADD COLUMN "playerId" TEXT;
ALTER TABLE "PressQuestion" ADD COLUMN "outcomeJson" TEXT;

-- Importance des messages (boîte de réception façon FM) : urgent / important / info.
ALTER TABLE "InboxMessage" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'info';
UPDATE "InboxMessage" SET "priority" = 'urgent' WHERE "type" IN ('trade_request', 'player_request', 'trade_offer', 'poach_offer');
UPDATE "InboxMessage" SET "priority" = 'important' WHERE "type" IN ('injury', 'contract', 'board', 'fine', 'free_agency', 'free_agent', 'cup', 'award', 'staff', 'press');
CREATE INDEX "InboxMessage_careerId_teamId_season_idx" ON "InboxMessage"("careerId", "teamId", "season");

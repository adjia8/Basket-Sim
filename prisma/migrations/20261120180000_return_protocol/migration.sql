ALTER TABLE "PlayerState" ADD COLUMN "returnProtocol" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "protocolGamesLeft" INTEGER NOT NULL DEFAULT 0;

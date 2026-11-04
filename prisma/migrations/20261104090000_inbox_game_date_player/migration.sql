-- Boîte de réception : date du jeu (et non date réelle de création) et
-- joueur concerné, pour les actions directes dans les messages.
ALTER TABLE "InboxMessage" ADD COLUMN "gameDate" TIMESTAMP(3);
ALTER TABLE "InboxMessage" ADD COLUMN "playerId" TEXT;

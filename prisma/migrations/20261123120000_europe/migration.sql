-- Joueurs en Europe (club, contrat, clause de rachat) et droits NBA
-- (draft-and-stash, rachat payé) — voir europe-rules.ts.
ALTER TABLE "PlayerState" ADD COLUMN "abroadClub" TEXT;
ALTER TABLE "PlayerState" ADD COLUMN "abroadYears" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerState" ADD COLUMN "buyout" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerState" ADD COLUMN "rightsTeamId" TEXT;

-- Causeries d'équipe : état à la mi-temps et causeries du GM.
ALTER TABLE "Game" ADD COLUMN "halftimeJson" TEXT;
ALTER TABLE "Game" ADD COLUMN "talksJson" TEXT;

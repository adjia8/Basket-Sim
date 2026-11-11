-- Potentiel caché des joueurs et des prospects (voir potential-rules.ts).
ALTER TABLE "PlayerState" ADD COLUMN "potential" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Prospect" ADD COLUMN "potential" INTEGER NOT NULL DEFAULT 0;

-- Carrières et classes de draft existantes : même formule que
-- initialPotential (marge tirée au hasard selon l'âge).
UPDATE "PlayerState" SET "potential" = LEAST(99, ROUND("overallRating" + CASE
  WHEN "age" <= 19 THEN 6 + random() * 16
  WHEN "age" <= 21 THEN 4 + random() * 13
  WHEN "age" <= 23 THEN 2 + random() * 9
  WHEN "age" <= 25 THEN random() * 6
  WHEN "age" <= 27 THEN random() * 3
  ELSE 0 END));
UPDATE "Prospect" SET "potential" = LEAST(99, ROUND("overallRating" + CASE
  WHEN "age" <= 19 THEN 6 + random() * 16
  WHEN "age" <= 21 THEN 4 + random() * 13
  WHEN "age" <= 23 THEN 2 + random() * 9
  ELSE random() * 6 END));

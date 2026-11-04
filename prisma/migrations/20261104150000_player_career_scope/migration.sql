-- Joueurs créés par une draft : rattachés à leur Career (null = vrai joueur
-- du catalogue, commun à toutes les carrières). Sans ce champ, un joueur
-- drafté dans une carrière apparaissait comme agent libre — et même dans
-- le roster de départ — de toutes les autres.
ALTER TABLE "Player" ADD COLUMN "careerId" TEXT;
CREATE INDEX "Player_careerId_idx" ON "Player"("careerId");

-- Les joueurs draftés existants (identifiant UUID, jamais utilisé par le
-- catalogue) sont rattachés à la carrière de leur état de joueur...
UPDATE "Player" AS p
SET "careerId" = s."careerId"
FROM "PlayerState" AS s
WHERE s."playerId" = p."id"
  AND p."id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ...et ceux dont la carrière a été supprimée (aucun état restant) sont
-- retirés : plus rien ne les référence.
DELETE FROM "PlayerTeamStint"
WHERE "playerId" IN (
  SELECT "id" FROM "Player"
  WHERE "careerId" IS NULL
    AND "id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
DELETE FROM "Player"
WHERE "careerId" IS NULL
  AND "id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (SELECT 1 FROM "Contract" c WHERE c."playerId" = "Player"."id")
  AND NOT EXISTS (SELECT 1 FROM "PlayerState" s WHERE s."playerId" = "Player"."id");

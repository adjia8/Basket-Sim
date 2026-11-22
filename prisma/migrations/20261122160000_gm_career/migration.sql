-- Carrière du GM : réputation, relation avec les médias, contrat, fortune
-- personnelle et train de vie — voir gm-career-rules.ts.
ALTER TABLE "GmProfile" ADD COLUMN "reputation" INTEGER NOT NULL DEFAULT 45;
ALTER TABLE "GmProfile" ADD COLUMN "mediaRelation" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "GmProfile" ADD COLUMN "contractSalary" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GmProfile" ADD COLUMN "contractYears" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GmProfile" ADD COLUMN "pendingOfferJson" TEXT;
ALTER TABLE "GmProfile" ADD COLUMN "pendingExtensionJson" TEXT;
ALTER TABLE "GmProfile" ADD COLUMN "personalCash" INTEGER NOT NULL DEFAULT 250000;
ALTER TABLE "GmProfile" ADD COLUMN "lifestyleJson" TEXT;
ALTER TABLE "GmProfile" ADD COLUMN "lastSeasonChangesJson" TEXT;

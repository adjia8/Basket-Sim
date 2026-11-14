-- Plusieurs carrières par compte : Membership.userId n'est plus unique.
DROP INDEX "Membership_userId_key";
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- Carrière active du compte (reprise : la carrière existante de chacun).
ALTER TABLE "User" ADD COLUMN "activeMembershipId" TEXT;
UPDATE "User" u SET "activeMembershipId" = m."id" FROM "Membership" m WHERE m."userId" = u."id";

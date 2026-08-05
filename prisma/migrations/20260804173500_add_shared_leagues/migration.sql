-- DropForeignKey
ALTER TABLE "Career" DROP CONSTRAINT "Career_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Career" DROP CONSTRAINT "Career_userId_fkey";

-- DropIndex
DROP INDEX "Career_userId_key";

-- AlterTable
ALTER TABLE "Career" DROP COLUMN "teamId",
DROP COLUMN "userId",
ADD COLUMN     "inviteCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "awayReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOfferItem" (
    "id" TEXT NOT NULL,
    "tradeOfferId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "side" TEXT NOT NULL,

    CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_careerId_idx" ON "Membership"("careerId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_careerId_teamId_key" ON "Membership"("careerId", "teamId");

-- CreateIndex
CREATE INDEX "TradeOffer_careerId_idx" ON "TradeOffer"("careerId");

-- CreateIndex
CREATE INDEX "TradeOffer_toTeamId_idx" ON "TradeOffer"("toTeamId");

-- CreateIndex
CREATE INDEX "TradeOfferItem_tradeOfferId_idx" ON "TradeOfferItem"("tradeOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "Career_inviteCode_key" ON "Career"("inviteCode");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_tradeOfferId_fkey" FOREIGN KEY ("tradeOfferId") REFERENCES "TradeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


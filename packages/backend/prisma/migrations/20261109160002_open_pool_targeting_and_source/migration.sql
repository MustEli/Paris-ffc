-- CreateEnum
CREATE TYPE "OpenPoolTaskSourceType" AS ENUM ('reception', 'seller_stock_pallet');

-- AlterTable
ALTER TABLE "OpenPoolTask" ADD COLUMN "targetUserId" TEXT;
ALTER TABLE "OpenPoolTask" ADD COLUMN "sourceType" "OpenPoolTaskSourceType";
ALTER TABLE "OpenPoolTask" ADD COLUMN "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "OpenPoolTask_targetUserId_idx" ON "OpenPoolTask"("targetUserId");

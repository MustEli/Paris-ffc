-- DropTable
-- "Put-Away & Location Assignment" feature removed (customer request — locations are predefined/obvious to staff, no longer tracked).
DROP TABLE "WarehouseLocation";

-- AlterTable
ALTER TABLE "Reception" DROP COLUMN "putAwayLocation",
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "assignedByUserId" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'normal';

-- CreateIndex
CREATE INDEX "Reception_assignedToUserId_idx" ON "Reception"("assignedToUserId");

-- AlterTable
ALTER TABLE "SellerStockPallet" DROP COLUMN "putAwayLocation";

-- CreateEnum
CREATE TYPE "ReceptionTaskOutcome" AS ENUM ('completed', 'unfinished');

-- CreateTable
CREATE TABLE "ReceptionTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
    "outcome" "ReceptionTaskOutcome",
    "receptionId" TEXT,

    CONSTRAINT "ReceptionTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceptionTask_userId_idx" ON "ReceptionTask"("userId");

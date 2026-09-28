-- CreateEnum
CREATE TYPE "OpenPoolTaskStatus" AS ENUM ('open', 'claimed', 'completed');

-- CreateTable
CREATE TABLE "OpenPoolTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "createdByUserId" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "status" "OpenPoolTaskStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OpenPoolTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpenPoolTask_status_idx" ON "OpenPoolTask"("status");

-- CreateIndex
CREATE INDEX "OpenPoolTask_claimedByUserId_idx" ON "OpenPoolTask"("claimedByUserId");

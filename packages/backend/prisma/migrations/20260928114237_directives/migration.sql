-- CreateEnum
CREATE TYPE "DirectiveType" AS ENUM ('photo_demand', 'clear_stalled_task', 'recount_inventory', 'verify_location', 'custom');

-- CreateEnum
CREATE TYPE "DirectiveStatus" AS ENUM ('pushed', 'in_progress', 'resolved');

-- CreateTable
CREATE TABLE "Directive" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT,
    "issuerUserId" TEXT NOT NULL,
    "type" "DirectiveType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "DirectiveStatus" NOT NULL DEFAULT 'pushed',
    "receivedByUserId" TEXT,
    "photoUrl" TEXT,
    "pushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Directive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Directive_targetUserId_idx" ON "Directive"("targetUserId");

-- CreateIndex
CREATE INDEX "Directive_status_idx" ON "Directive"("status");

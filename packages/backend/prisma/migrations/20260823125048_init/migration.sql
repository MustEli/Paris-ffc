-- CreateEnum
CREATE TYPE "Role" AS ENUM ('staff', 'admin', 'management');

-- CreateEnum
CREATE TYPE "ReceptionCategory" AS ENUM ('return_parcels', 'packaging_stock', 'sellers_stock', 'equipment_other');

-- CreateEnum
CREATE TYPE "ReceptionStatus" AS ENUM ('arrived', 'ready_for_putaway', 'completed');

-- CreateEnum
CREATE TYPE "PalletCondition" AS ENUM ('good', 'damaged');

-- CreateEnum
CREATE TYPE "SellerStockStatus" AS ENUM ('ready_for_putaway', 'pending_admin_review', 'instructed', 'put_away');

-- CreateEnum
CREATE TYPE "PutAwayTaskStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'issue_reported');

-- CreateEnum
CREATE TYPE "OrderPrepTaskRole" AS ENUM ('picker', 'packer');

-- CreateEnum
CREATE TYPE "OrderPrepTaskStatus" AS ENUM ('assigned', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reception" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "ReceptionStatus" NOT NULL,
    "category" "ReceptionCategory" NOT NULL,
    "parcelCount" INTEGER,
    "transporterCompany" TEXT,
    "packagingType" TEXT,
    "palletCount" INTEGER,
    "itemDescription" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "instructions" TEXT,
    "putAwayAt" TIMESTAMP(3),
    "processingDurationMs" INTEGER,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Reception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerStockPallet" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "boxNumber" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "overweightFlag" BOOLEAN NOT NULL,
    "condition" "PalletCondition" NOT NULL,
    "damageRemarks" TEXT,
    "damageEvidencePhotoUrls" TEXT[],
    "labelPhotoUrls" TEXT[],
    "status" "SellerStockStatus" NOT NULL,
    "putAwayLocation" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "putAwayAt" TIMESTAMP(3),

    CONSTRAINT "SellerStockPallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PutAwayTask" (
    "id" TEXT NOT NULL,
    "palletId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "PutAwayTaskStatus" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "issueDescription" TEXT,

    CONSTRAINT "PutAwayTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPrepSession" (
    "id" TEXT NOT NULL,
    "totalParts" INTEGER NOT NULL,
    "pickersNeeded" INTEGER NOT NULL,
    "packersNeeded" INTEGER NOT NULL,
    "packingDelayMinutes" INTEGER NOT NULL,
    "pickingStartedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPrepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPrepTask" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "OrderPrepTaskRole" NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "status" "OrderPrepTaskStatus" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "OrderPrepTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Shift_userId_idx" ON "Shift"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerStockPallet_seq_key" ON "SellerStockPallet"("seq");

-- CreateIndex
CREATE INDEX "PutAwayTask_palletId_idx" ON "PutAwayTask"("palletId");

-- CreateIndex
CREATE INDEX "PutAwayTask_assignedToUserId_idx" ON "PutAwayTask"("assignedToUserId");

-- CreateIndex
CREATE INDEX "OrderPrepTask_sessionId_idx" ON "OrderPrepTask"("sessionId");

-- CreateIndex
CREATE INDEX "OrderPrepTask_assignedToUserId_idx" ON "OrderPrepTask"("assignedToUserId");

-- CreateEnum
CREATE TYPE "FloorTaskCategory" AS ENUM ('pick', 'pack', 'return_processing', 'box_prep', 'warehousing_inventory_check', 'warehousing_location_adjustment', 'backup_box', 'backup_shredder', 'backup_other');

-- CreateTable
CREATE TABLE "FloorTaskLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FloorTaskCategory" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "count" INTEGER,
    "countExtra" INTEGER,
    "zone" TEXT,
    "comment" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "FloorTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FloorTaskLog_userId_idx" ON "FloorTaskLog"("userId");

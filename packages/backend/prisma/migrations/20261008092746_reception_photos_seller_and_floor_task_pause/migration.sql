-- AlterEnum
ALTER TYPE "ReferenceListCategory" ADD VALUE 'seller_name';

-- AlterTable
ALTER TABLE "FloorTaskLog" ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "totalPausedMs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Reception" ADD COLUMN     "invoicePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sellerName" TEXT;

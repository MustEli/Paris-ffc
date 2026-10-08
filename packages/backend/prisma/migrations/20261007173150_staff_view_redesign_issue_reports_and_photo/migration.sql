-- CreateEnum
CREATE TYPE "IssueReportCategory" AS ENUM ('non_traceable_return_parcel', 'non_fulfillment_return_parcel', 'no_return_request_generated', 'shipment_label_not_generatable', 'item_found_out_of_location', 'empty_crate', 'part_broken_in_location', 'heavy_crate', 'other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "IssueReportCategory" NOT NULL,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trackingId" TEXT,
    "orderNumber" TEXT,
    "errorNo" TEXT,
    "idNumber" TEXT,
    "locationId" TEXT,
    "comment" TEXT,
    "alertsAdmin" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueReport_userId_idx" ON "IssueReport"("userId");

-- CreateIndex
CREATE INDEX "IssueReport_alertsAdmin_idx" ON "IssueReport"("alertsAdmin");

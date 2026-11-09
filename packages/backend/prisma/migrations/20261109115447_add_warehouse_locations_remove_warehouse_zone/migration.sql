-- AlterEnum
-- Removes the now-unused `warehouse_zone` value, superseded by the
-- dedicated WarehouseLocation table below (no existing rows used this
-- value, confirmed before writing this migration).
BEGIN;
CREATE TYPE "ReferenceListCategory_new" AS ENUM ('transporter_company', 'packaging_type', 'issue_type', 'color_tag', 'seller_name');
ALTER TABLE "ReferenceListValue" ALTER COLUMN "category" TYPE "ReferenceListCategory_new" USING ("category"::text::"ReferenceListCategory_new");
ALTER TYPE "ReferenceListCategory" RENAME TO "ReferenceListCategory_old";
ALTER TYPE "ReferenceListCategory_new" RENAME TO "ReferenceListCategory";
DROP TYPE "ReferenceListCategory_old";
COMMIT;

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_location_key" ON "WarehouseLocation"("location");

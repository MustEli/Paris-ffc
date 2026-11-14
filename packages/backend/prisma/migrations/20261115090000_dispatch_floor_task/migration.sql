-- AlterEnum
-- Adding a value is safe directly (Postgres 9.1+) — only removals need the full recreate dance.
ALTER TYPE "FloorTaskCategory" ADD VALUE 'dispatch';

-- AlterTable
ALTER TABLE "FloorTaskLog" ADD COLUMN "scannedBarcode" TEXT;

-- CreateEnum
CREATE TYPE "ReferenceListCategory" AS ENUM ('transporter_company', 'packaging_type');

-- CreateTable
CREATE TABLE "ReferenceListValue" (
    "id" TEXT NOT NULL,
    "category" "ReferenceListCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceListValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferenceListValue_category_idx" ON "ReferenceListValue"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceListValue_category_value_key" ON "ReferenceListValue"("category", "value");

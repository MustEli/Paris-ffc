-- CreateTable
CREATE TABLE "Break" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Break_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Break_shiftId_idx" ON "Break"("shiftId");

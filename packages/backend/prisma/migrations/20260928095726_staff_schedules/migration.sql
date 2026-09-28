-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "hoursCompleteAt" TIMESTAMP(3),
ADD COLUMN     "lunchBreakWarnedAt" TIMESTAMP(3),
ADD COLUMN     "paidBreakWarnedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "userId" TEXT NOT NULL,
    "workingDays" "Weekday"[],
    "shiftStartTime" TEXT NOT NULL,
    "shiftEndTime" TEXT NOT NULL,
    "requiredWorkingHours" DOUBLE PRECISION NOT NULL,
    "paidBreakStartTime" TEXT,
    "lunchBreakStartTime" TEXT,
    "lunchBreakDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("userId")
);

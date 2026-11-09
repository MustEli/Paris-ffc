-- AlterTable
-- Drops the "paid break at" / "lunch break at" reminder-anchor columns
-- (client request: schedule editor shows durations, not clock times —
-- the pre-break push reminder these drove is being removed too).
ALTER TABLE "Shift" DROP COLUMN "paidBreakWarnedAt";
ALTER TABLE "Shift" DROP COLUMN "lunchBreakWarnedAt";

-- AlterTable
ALTER TABLE "StaffSchedule" DROP COLUMN "paidBreakStartTime";
ALTER TABLE "StaffSchedule" DROP COLUMN "lunchBreakStartTime";

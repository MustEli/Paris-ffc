-- CreateEnum
CREATE TYPE "BreakType" AS ENUM ('lunch', 'short');

-- AlterTable
ALTER TABLE "Break" ADD COLUMN     "type" "BreakType" NOT NULL DEFAULT 'lunch';

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3);

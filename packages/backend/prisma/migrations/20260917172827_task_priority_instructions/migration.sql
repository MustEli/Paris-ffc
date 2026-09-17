-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('normal', 'high', 'urgent');

-- AlterTable
ALTER TABLE "OrderPrepTask" ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "PutAwayTask" ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'normal';

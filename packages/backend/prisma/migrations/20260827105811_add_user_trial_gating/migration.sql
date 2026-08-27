-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canCreateUsers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loginLimit" INTEGER;

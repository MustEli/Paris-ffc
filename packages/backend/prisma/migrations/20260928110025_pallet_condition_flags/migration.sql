-- CreateEnum
CREATE TYPE "PalletConditionFlag" AS ENUM ('good', 'overweight', 'overloaded', 'damaged', 'location_name_needed');

-- AlterTable
ALTER TABLE "SellerStockPallet" ADD COLUMN     "conditionFlags" "PalletConditionFlag"[] DEFAULT ARRAY[]::"PalletConditionFlag"[];

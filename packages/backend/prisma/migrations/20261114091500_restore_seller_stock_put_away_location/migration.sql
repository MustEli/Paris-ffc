-- The previous migration dropped this column, but it's still needed:
-- PutAwayService (giveInstructions/updateLocation) writes the Admin-typed
-- location here when assigning a reviewed pallet, independent of the
-- removed staff-facing predefined-location picker. Restoring it.
ALTER TABLE "SellerStockPallet" ADD COLUMN     "putAwayLocation" TEXT;

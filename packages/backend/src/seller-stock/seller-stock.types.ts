/**
 * Feature 3 (Seller Stock Reception) from the requirements doc. The doc's
 * two branches (good vs. damaged/overweight) both converge on the same
 * "admin gives put-away location" step, so status here isn't split by
 * branch — condition/overweightFlag capture *why* it needed review, and
 * status tracks progress through: logged → instructed → put_away.
 * "Batch completion" (doc Step 4, grouping multiple pallets) isn't
 * modeled — each pallet is its own record; nothing stops logging several
 * in a row, which is what a batch amounts to for this slice.
 */
export type PalletCondition = 'good' | 'damaged';

export type SellerStockStatus =
  | 'ready_for_putaway' // good condition, <= 700kg — normal path
  | 'pending_admin_review' // damaged and/or overweight — doc's Branch B
  | 'instructed' // admin has given a put-away location (either branch)
  | 'put_away'; // staff confirmed the pallet is placed

export const OVERWEIGHT_THRESHOLD_KG = 700;

export interface SellerStockPallet {
  id: string;
  /** Human-readable index for physically labeling the pallet — doc's "Dual Data Pairing". */
  palletIndex: string;
  boxNumber: string;
  sellerName: string;
  weightKg: number;
  overweightFlag: boolean;
  condition: PalletCondition;
  damageRemarks: string | null;
  damageEvidencePhotoUrls: string[];
  labelPhotoUrl: string;
  status: SellerStockStatus;
  putAwayLocation: string | null;
  createdByUserId: string;
  createdAt: string;
  putAwayAt: string | null;
}

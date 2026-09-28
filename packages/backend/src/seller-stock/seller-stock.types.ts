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

/**
 * Staff's own multi-select report of what they observed on intake
 * (Staff View doc). `condition` above stays a derived legacy value —
 * see SellerStockService.create() — computed as 'good' only when this
 * is exactly `['good']`, 'damaged' otherwise. Any flag other than a
 * lone 'good' routes the pallet to Admin review, same as before.
 */
export type PalletConditionFlag = 'good' | 'overweight' | 'overloaded' | 'damaged' | 'location_name_needed';

export const CONDITION_FLAGS: PalletConditionFlag[] = [
  'good',
  'overweight',
  'overloaded',
  'damaged',
  'location_name_needed',
];

export type SellerStockStatus =
  | 'ready_for_putaway' // good condition, <= 700kg — normal path
  | 'pending_admin_review' // damaged and/or overweight — doc's Branch B
  | 'instructed' // admin has given a put-away location (either branch)
  | 'put_away'; // staff confirmed the pallet is placed

export const OVERWEIGHT_THRESHOLD_KG = 700;

/** Cap on how many photos can be attached to damage evidence — user-requested (2026-08-21), was single-photo-only for the label originally (label now has its own, stricter limits below). */
export const MAX_PHOTOS_PER_FIELD = 6;

/**
 * "Delivery Proof" (was "Shipping label photo") — user-requested
 * (2026-09-17): a real minimum, not just a maximum, since staff were
 * sometimes attaching only one photo when both a shipping-label shot
 * and a box-number shot are expected. Still just a plain photo list
 * server-side (no distinct "this one is the label, this one is the box
 * number" typing) — the 2-required/3-max limits plus the mobile label's
 * guidance text carry that intent without needing two separate fields.
 */
export const DELIVERY_PROOF_PHOTOS_MIN = 2;
export const DELIVERY_PROOF_PHOTOS_MAX = 3;

export interface SellerStockPallet {
  id: string;
  /** Human-readable index for physically labeling the pallet — doc's "Dual Data Pairing". */
  palletIndex: string;
  boxNumber: string;
  sellerName: string;
  weightKg: number;
  overweightFlag: boolean;
  condition: PalletCondition;
  conditionFlags: PalletConditionFlag[];
  damageRemarks: string | null;
  damageEvidencePhotoUrls: string[];
  labelPhotoUrls: string[];
  status: SellerStockStatus;
  putAwayLocation: string | null;
  createdByUserId: string;
  createdAt: string;
  putAwayAt: string | null;
}

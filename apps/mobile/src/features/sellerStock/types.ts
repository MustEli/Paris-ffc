/** Mirrors packages/backend/src/seller-stock/seller-stock.types.ts. */
export type PalletCondition = 'good' | 'damaged';

/** Staff's own multi-select report — exactly ['good'] is the only combination that skips Admin review. */
export type PalletConditionFlag = 'good' | 'overweight' | 'overloaded' | 'damaged' | 'location_name_needed';

export const CONDITION_FLAGS: PalletConditionFlag[] = [
  'good',
  'overweight',
  'overloaded',
  'damaged',
  'location_name_needed',
];

export const CONDITION_FLAG_LABELS: Record<PalletConditionFlag, string> = {
  good: 'Good Condition',
  overweight: 'Over Weight',
  overloaded: 'Over Loaded',
  damaged: 'Damaged',
  location_name_needed: 'Location Name Needed',
};

export type SellerStockStatus = 'ready_for_putaway' | 'pending_admin_review' | 'instructed' | 'put_away';

export const OVERWEIGHT_THRESHOLD_KG = 700;

/** Cap on how many photos can be attached to damage evidence. */
export const MAX_PHOTOS_PER_FIELD = 6;

/** "Delivery Proof" (was "Shipping label photo") — mirrors packages/backend/src/seller-stock/seller-stock.types.ts. */
export const DELIVERY_PROOF_PHOTOS_MIN = 2;
export const DELIVERY_PROOF_PHOTOS_MAX = 3;

export interface SellerStockPallet {
  id: string;
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

export const STATUS_LABELS: Record<SellerStockStatus, string> = {
  ready_for_putaway: 'In put-away pipeline',
  pending_admin_review: 'Pending admin review',
  instructed: 'Instructed — ready to place',
  put_away: 'Put away',
};

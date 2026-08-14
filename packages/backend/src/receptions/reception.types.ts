/**
 * Feature 2 (Reception — Incoming Flow) from the requirements doc.
 * Deliberately scoped for this vertical slice — see receptions.service.ts
 * for what's cut and why.
 */
export type ReceptionCategory = 'return_parcels' | 'packaging_stock' | 'sellers_stock' | 'equipment_other';

/**
 * "arrived" covers both doc Step 1 (arrival) and Step 2 (data entry) —
 * they happen in one API call here rather than two, since splitting
 * them wouldn't add anything for this slice. It means "logged, waiting
 * on admin instructions" until it moves to ready_for_putaway.
 */
export type ReceptionStatus = 'arrived' | 'ready_for_putaway' | 'completed';

export interface ReturnParcelsDetails {
  category: 'return_parcels';
  parcelCount: number;
  transporterCompany: string;
}

export interface PackagingStockDetails {
  category: 'packaging_stock';
  parcelCount: number;
  packagingType: string;
}

/**
 * The doc says "see Feature 3 for details" for Sellers Stock — Feature 3
 * (per-pallet weight/condition/damage branching) is its own, separate,
 * more complex vertical slice, not built yet. This category exists here
 * only so Reception's 4-way category picker matches the spec; it collects
 * just the pallet count until Feature 3 is built.
 */
export interface SellersStockDetails {
  category: 'sellers_stock';
  palletCount: number;
}

/**
 * Doc also requires "photo of what received" for this category. Photo
 * capture (expo-camera/image-picker + upload handling) is deliberately
 * deferred — same kind of scope cut as Attendance's geofencing/breaks
 * ("Future developments" in the doc). Text fields only for now.
 */
export interface EquipmentOtherDetails {
  category: 'equipment_other';
  parcelCount: number;
  itemDescription: string;
}

export type ReceptionDetails =
  | ReturnParcelsDetails
  | PackagingStockDetails
  | SellersStockDetails
  | EquipmentOtherDetails;

export interface Reception {
  id: string;
  createdByUserId: string;
  status: ReceptionStatus;
  details: ReceptionDetails;
  arrivedAt: string;
  instructions: string | null;
  putAwayAt: string | null;
  processingDurationMs: number | null;
  /** Doc Step 5 (marked "Optional" there too): flagged if processing exceeds 2 hours. */
  flaggedForReview: boolean;
}

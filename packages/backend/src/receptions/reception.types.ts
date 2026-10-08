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
  /** Picked from the `seller_name` reference list. */
  sellerName: string;
  /** "If there are any" — optional, unlike equipment_other's required equipment photo. */
  invoicePhotoUrls: string[];
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

/** Doc's "photo of what received" — photo of the equipment itself is required; an invoice photo is optional ("if there are any"). */
export interface EquipmentOtherDetails {
  category: 'equipment_other';
  parcelCount: number;
  itemDescription: string;
  photoUrls: string[];
  invoicePhotoUrls: string[];
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

/** One row's outcome from ReceptionsService.bulkAddInstructions() — a bad id/status in one row never aborts the rest. */
export interface BulkInstructionResult {
  id: string;
  success: boolean;
  error: string | null;
}

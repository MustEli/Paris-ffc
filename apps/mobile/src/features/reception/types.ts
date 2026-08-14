/** Mirrors packages/backend/src/receptions/reception.types.ts. */
export type ReceptionCategory = 'return_parcels' | 'packaging_stock' | 'sellers_stock' | 'equipment_other';

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

export interface SellersStockDetails {
  category: 'sellers_stock';
  palletCount: number;
}

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
  flaggedForReview: boolean;
}

export const CATEGORY_LABELS: Record<ReceptionCategory, string> = {
  return_parcels: 'Return Parcels',
  packaging_stock: 'Packaging Stock',
  sellers_stock: 'Sellers Stock',
  equipment_other: 'Equipment & Other',
};

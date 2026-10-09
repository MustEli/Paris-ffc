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
  sellerName: string;
  invoicePhotoUrls: string[];
}

export interface SellersStockDetails {
  category: 'sellers_stock';
  palletCount: number;
}

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
  flaggedForReview: boolean;
}

/** Values are i18n keys (see core/i18n/translations/en.ts's `reception` namespace), not display text — callers must wrap with t(). */
export const CATEGORY_LABELS: Record<ReceptionCategory, string> = {
  return_parcels: 'reception.returnParcels',
  packaging_stock: 'reception.packagingStock',
  sellers_stock: 'reception.sellersStock',
  equipment_other: 'reception.equipmentOther',
};

import { apiRequest } from './client';

/** Mirrors packages/backend/src/receptions/reception.types.ts (and apps/mobile's copy of the same). */
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
export type ReceptionDetails = ReturnParcelsDetails | PackagingStockDetails | SellersStockDetails | EquipmentOtherDetails;

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

export const STATUS_LABELS: Record<ReceptionStatus, string> = {
  arrived: 'Awaiting instructions',
  ready_for_putaway: 'Ready for put-away',
  completed: 'Completed',
};

export function summarizeDetails(reception: Reception): string {
  const { details } = reception;
  switch (details.category) {
    case 'return_parcels':
      return `${details.parcelCount} parcel(s) from ${details.transporterCompany}`;
    case 'packaging_stock':
      return `${details.parcelCount} parcel(s) — ${details.packagingType}`;
    case 'sellers_stock':
      return `${details.palletCount} pallet(s)`;
    case 'equipment_other':
      return `${details.parcelCount} parcel(s) — ${details.itemDescription}`;
  }
}

export function fetchReceptions(token: string) {
  return apiRequest<Reception[]>('/receptions', { token });
}

/** Single-item instructions — for the quick inline case; bulkAddInstructions below is the Excel flow. */
export function addInstructions(token: string, id: string, instructions: string) {
  return apiRequest<Reception>(`/receptions/${id}/instructions`, { method: 'POST', token, body: { instructions } });
}

export interface BulkInstructionItem {
  id: string;
  instructions: string;
}

export interface BulkInstructionResult {
  id: string;
  success: boolean;
  error: string | null;
}

export function bulkAddInstructions(token: string, items: BulkInstructionItem[]) {
  return apiRequest<BulkInstructionResult[]>('/receptions/bulk-instructions', {
    method: 'POST',
    token,
    body: { items },
  });
}

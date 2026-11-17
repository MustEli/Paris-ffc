import { apiRequest } from './client';

/** Mirrors packages/backend/src/seller-stock/seller-stock.types.ts (and apps/mobile's copy of the same). */
export type PalletCondition = 'good' | 'damaged';
export type PalletConditionFlag = 'good' | 'overweight' | 'overloaded' | 'damaged' | 'location_name_needed' | 'other';
export type SellerStockStatus = 'ready_for_putaway' | 'pending_admin_review' | 'instructed' | 'put_away';

export const PALLET_CONDITION_FLAGS: PalletConditionFlag[] = [
  'good',
  'overweight',
  'overloaded',
  'damaged',
  'location_name_needed',
  'other',
];

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

export const SELLER_STOCK_STATUSES: SellerStockStatus[] = [
  'ready_for_putaway',
  'pending_admin_review',
  'instructed',
  'put_away',
];

export function fetchPallets(token: string) {
  return apiRequest<SellerStockPallet[]>('/seller-stock', { token });
}

export function deletePallet(token: string, id: string) {
  return apiRequest<void>(`/seller-stock/${id}`, { method: 'DELETE', token });
}

export function deletePallets(token: string, ids: string[]) {
  return apiRequest<{ deletedCount: number }>('/seller-stock', { method: 'DELETE', token, body: { ids } });
}

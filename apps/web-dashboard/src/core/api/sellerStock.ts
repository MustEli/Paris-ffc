import { apiRequest } from './client';

/** Mirrors packages/backend/src/seller-stock/seller-stock.types.ts (and apps/mobile's copy of the same). */
export type PalletCondition = 'good' | 'damaged';
export type SellerStockStatus = 'ready_for_putaway' | 'pending_admin_review' | 'instructed' | 'put_away';

export interface SellerStockPallet {
  id: string;
  palletIndex: string;
  boxNumber: string;
  sellerName: string;
  weightKg: number;
  overweightFlag: boolean;
  condition: PalletCondition;
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

export function fetchPallets(token: string) {
  return apiRequest<SellerStockPallet[]>('/seller-stock', { token });
}

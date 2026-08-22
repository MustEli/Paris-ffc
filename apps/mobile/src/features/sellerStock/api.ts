import { apiRequest } from '../../core/api/client';
import { type PalletCondition, type SellerStockPallet } from './types';

export interface CreatePalletInput {
  labelPhotoUrls: string[];
  boxNumber: string;
  sellerName: string;
  weightKg: number;
  condition: PalletCondition;
  damageRemarks?: string;
  damageEvidencePhotoUrls?: string[];
}

// NOTE: put-away assignment (instructions/complete) used to live here as
// giveInstructions()/putAway() — moved to features/putAway, a proper
// per-staff task-assignment layer (Feature 4). This file now only
// covers intake (Feature 3).

export function listPallets(token: string) {
  return apiRequest<SellerStockPallet[]>('/seller-stock', { token });
}

export function getPallet(token: string, id: string) {
  return apiRequest<SellerStockPallet>(`/seller-stock/${id}`, { token });
}

export function createPallet(token: string, input: CreatePalletInput) {
  return apiRequest<SellerStockPallet>('/seller-stock', { method: 'POST', token, body: input });
}

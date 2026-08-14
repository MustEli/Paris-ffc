import { apiRequest } from '../../core/api/client';
import { type PalletCondition, type SellerStockPallet } from './types';

export interface CreatePalletInput {
  labelPhotoUrl: string;
  boxNumber: string;
  sellerName: string;
  weightKg: number;
  condition: PalletCondition;
  damageRemarks?: string;
  damageEvidencePhotoUrls?: string[];
}

export function listPallets(token: string) {
  return apiRequest<SellerStockPallet[]>('/seller-stock', { token });
}

export function getPallet(token: string, id: string) {
  return apiRequest<SellerStockPallet>(`/seller-stock/${id}`, { token });
}

export function createPallet(token: string, input: CreatePalletInput) {
  return apiRequest<SellerStockPallet>('/seller-stock', { method: 'POST', token, body: input });
}

export function giveInstructions(token: string, id: string, location: string) {
  return apiRequest<SellerStockPallet>(`/seller-stock/${id}/instructions`, {
    method: 'POST',
    token,
    body: { location },
  });
}

export function putAway(token: string, id: string) {
  return apiRequest<SellerStockPallet>(`/seller-stock/${id}/put-away`, { method: 'POST', token });
}

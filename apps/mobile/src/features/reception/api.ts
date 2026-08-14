import { apiRequest } from '../../core/api/client';
import { type Reception, type ReceptionCategory } from './types';

export interface CreateReceptionInput {
  category: ReceptionCategory;
  parcelCount?: number;
  palletCount?: number;
  transporterCompany?: string;
  packagingType?: string;
  itemDescription?: string;
}

export function listReceptions(token: string) {
  return apiRequest<Reception[]>('/receptions', { token });
}

export function getReception(token: string, id: string) {
  return apiRequest<Reception>(`/receptions/${id}`, { token });
}

export function createReception(token: string, input: CreateReceptionInput) {
  return apiRequest<Reception>('/receptions', { method: 'POST', token, body: input });
}

export function addInstructions(token: string, id: string, instructions: string) {
  return apiRequest<Reception>(`/receptions/${id}/instructions`, {
    method: 'POST',
    token,
    body: { instructions },
  });
}

export function completeReception(token: string, id: string) {
  return apiRequest<Reception>(`/receptions/${id}/complete`, { method: 'POST', token });
}

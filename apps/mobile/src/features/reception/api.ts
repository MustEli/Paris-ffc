import { apiRequest } from '../../core/api/client';
import { type Reception, type ReceptionCategory, type ReceptionTask } from './types';

export interface CreateReceptionInput {
  category: ReceptionCategory;
  parcelCount?: number;
  palletCount?: number;
  transporterCompany?: string;
  packagingType?: string;
  itemDescription?: string;
  sellerName?: string;
  photoUrls?: string[];
  invoicePhotoUrls?: string[];
  /** Links this submission back to the staff member's Reception-flow timer so it can be marked completed — see useReceptionTasks.ts. */
  receptionTaskId?: string;
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

/** Rejects with 409 if one's already open — see ReceptionStartScreen.tsx. */
export function startReceptionTask(token: string) {
  return apiRequest<ReceptionTask>('/reception-tasks/start', { method: 'POST', token });
}

export function pauseReceptionTask(token: string, id: string) {
  return apiRequest<ReceptionTask>(`/reception-tasks/${id}/pause`, { method: 'POST', token });
}

export function resumeReceptionTask(token: string, id: string) {
  return apiRequest<ReceptionTask>(`/reception-tasks/${id}/resume`, { method: 'POST', token });
}

/** Staff left the Reception flow without logging a delivery — flagged for admin as having no confirmed delivery. */
export function leaveUnfinishedReceptionTask(token: string, id: string) {
  return apiRequest<ReceptionTask>(`/reception-tasks/${id}/leave-unfinished`, { method: 'POST', token });
}

/** Null when nothing is currently open (or paused) — a normal state, not an error. */
export function fetchMyActiveReceptionTask(token: string) {
  return apiRequest<ReceptionTask | null>('/reception-tasks/mine/active', { token });
}

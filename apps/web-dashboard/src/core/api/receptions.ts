import { apiRequest } from './client';
import { type TaskPriority } from './tasks';

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
  /** No longer collected (customer request) — stays nullable so older receptions that do have one still display it. */
  sellerName: string | null;
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

  /** Task Board direct-assignment (see assignReception()) — a drag-a-pending-reception-onto-a-staff-member action, not an Open Pool task. */
  assignedToUserId: string | null;
  assignedByUserId: string | null;
  assignedAt: string | null;
  priority: TaskPriority;
}

export const RECEPTION_CATEGORIES: ReceptionCategory[] = [
  'return_parcels',
  'packaging_stock',
  'sellers_stock',
  'equipment_other',
];

export const RECEPTION_STATUSES: ReceptionStatus[] = ['arrived', 'ready_for_putaway', 'completed'];

/** `t` is any translator bound to (or able to reach via `{ ns: 'common' }`) the `common.receptionSummary.*` keys — pass the page's own `t`. */
export function summarizeDetails(reception: Reception, t: (key: string, options?: Record<string, unknown>) => string): string {
  const { details } = reception;
  switch (details.category) {
    case 'return_parcels':
      return t('receptionSummary.parcelsFrom', { ns: 'common', count: details.parcelCount, transporter: details.transporterCompany });
    case 'packaging_stock':
      return t('receptionSummary.parcelsPackaging', { ns: 'common', count: details.parcelCount, packagingType: details.packagingType });
    case 'sellers_stock':
      return t('receptionSummary.pallets', { ns: 'common', count: details.palletCount });
    case 'equipment_other':
      return t('receptionSummary.parcelsItem', { ns: 'common', count: details.parcelCount, item: details.itemDescription });
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

export interface AssignReceptionInput {
  assignedToUserId: string;
  instructions: string;
  priority?: TaskPriority;
}

/** Task Board's third pending-item type — drag a reception still awaiting instructions onto an on-shift staff member. Not an Open Pool task. */
export function assignReception(token: string, id: string, input: AssignReceptionInput) {
  return apiRequest<Reception>(`/receptions/${id}/assign`, { method: 'POST', token, body: input });
}

export function deleteReception(token: string, id: string) {
  return apiRequest<void>(`/receptions/${id}`, { method: 'DELETE', token });
}

export function deleteReceptions(token: string, ids: string[]) {
  return apiRequest<{ deletedCount: number }>('/receptions', { method: 'DELETE', token, body: { ids } });
}

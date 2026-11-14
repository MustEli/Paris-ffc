import { type TaskPriority } from '../tasks/priority';

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

  /** Task Board direct-assignment — a drag-a-pending-reception-onto-a-staff-member action, not an Open Pool task. */
  assignedToUserId: string | null;
  assignedByUserId: string | null;
  assignedAt: string | null;
  priority: TaskPriority;
}

/** Mirrors packages/backend/src/reception-tasks/reception-task.types.ts — times a staff member's trip into the Reception flow, from Start to either a logged delivery or an explicit "leave unfinished." */
export interface ReceptionTask {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  totalPausedMs: number;
  outcome: 'completed' | 'unfinished' | null;
  receptionId: string | null;
}

/** Values are i18n keys (see core/i18n/translations/en.ts's `reception` namespace), not display text — callers must wrap with t(). */
export const CATEGORY_LABELS: Record<ReceptionCategory, string> = {
  return_parcels: 'reception.returnParcels',
  packaging_stock: 'reception.packagingStock',
  sellers_stock: 'reception.sellersStock',
  equipment_other: 'reception.equipmentOther',
};

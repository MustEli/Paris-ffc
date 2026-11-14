import { type OrderPrepTaskRole } from '../order-prep/order-prep.types';
import { type ReceptionCategory } from '../receptions/reception.types';

/**
 * A "pending" item is deliberately NOT a database row — Put-Away and
 * Order-Prep tasks only exist once assigned (see put-away.service.ts /
 * order-prep.service.ts). A pending item is derived on read: a pallet
 * ready for put-away with no active task yet, or an Order-Prep session
 * still short of the picker/packer count it needs. This keeps the
 * existing assign-in-one-step flow (mobile's AssignTaskScreen) fully
 * working untouched — the Task Board is just a second way to reach the
 * same assign() methods, with a staff/pending view built for dragging.
 */
export interface PendingPutAwayItem {
  type: 'put_away';
  palletId: string;
  palletIndex: string;
  sellerName: string;
  status: 'ready_for_putaway' | 'pending_admin_review';
  createdAt: string;
}

export interface PendingOrderPrepItem {
  type: 'order_prep';
  sessionId: string;
  role: OrderPrepTaskRole;
  totalParts: number;
  createdAt: string;
}

/**
 * A reception still waiting on Admin's instructions (status `arrived`,
 * not yet assigned) — see ReceptionsService.assign(). Unlike the two
 * items above, this one IS a real database row already (a Reception),
 * just filtered by status/assignment the same "derived on read" way.
 */
export interface PendingReceptionItem {
  type: 'reception';
  receptionId: string;
  category: ReceptionCategory;
  summary: string;
  createdAt: string;
}

export type PendingTaskItem = PendingPutAwayItem | PendingOrderPrepItem | PendingReceptionItem;

export interface OnShiftStaffMember {
  userId: string;
  userName: string;
  shiftStartedAt: string;
}

export interface TaskBoard {
  onShiftStaff: OnShiftStaffMember[];
  pendingItems: PendingTaskItem[];
}

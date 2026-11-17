import { apiRequest } from './client';

/** Mirrors packages/backend/src/tasks/task-priority.ts. */
export type TaskPriority = 'normal' | 'high' | 'urgent';
export const TASK_PRIORITIES: TaskPriority[] = ['normal', 'high', 'urgent'];

/** Mirrors packages/backend/src/tasks/tasks.types.ts. */
export interface OnShiftStaffMember {
  userId: string;
  userName: string;
  shiftStartedAt: string;
}

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
  role: 'picker' | 'packer';
  totalParts: number;
  createdAt: string;
}

/** A reception still waiting on Admin's instructions (status `arrived`, not yet assigned) — see receptions.ts's assignReception(). */
export interface PendingReceptionItem {
  type: 'reception';
  receptionId: string;
  category: 'return_parcels' | 'packaging_stock' | 'sellers_stock' | 'equipment_other';
  summary: string;
  createdAt: string;
}

export type PendingTaskItem = PendingPutAwayItem | PendingOrderPrepItem | PendingReceptionItem;

export interface TaskBoard {
  onShiftStaff: OnShiftStaffMember[];
  pendingItems: PendingTaskItem[];
}

export function fetchTaskBoard(token: string) {
  return apiRequest<TaskBoard>('/tasks/board', { token });
}

export interface AssignPutAwayInput {
  palletId: string;
  assignedToUserId: string;
  location: string;
  priority: TaskPriority;
  instructions?: string;
  /** Admin-uploaded photos attached at assignment time — distinct from the pallet's own staff-captured damage evidence photos. */
  instructionPhotoUrls?: string[];
}

export function assignPutAway(token: string, input: AssignPutAwayInput) {
  return apiRequest('/put-away-tasks', { method: 'POST', token, body: input });
}

export interface AssignOrderPrepInput {
  sessionId: string;
  assignedToUserId: string;
  role: 'picker' | 'packer';
  priority: TaskPriority;
  instructions?: string;
}

export function assignOrderPrep(token: string, input: AssignOrderPrepInput) {
  return apiRequest(`/order-prep/sessions/${input.sessionId}/tasks`, {
    method: 'POST',
    token,
    body: { assignedToUserId: input.assignedToUserId, role: input.role, priority: input.priority, instructions: input.instructions },
  });
}

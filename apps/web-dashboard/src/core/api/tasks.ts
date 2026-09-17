import { apiRequest } from './client';

/** Mirrors packages/backend/src/tasks/task-priority.ts. */
export type TaskPriority = 'normal' | 'high' | 'urgent';
export const TASK_PRIORITIES: TaskPriority[] = ['normal', 'high', 'urgent'];
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

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

export type PendingTaskItem = PendingPutAwayItem | PendingOrderPrepItem;

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

/** Mirrors packages/backend/src/order-prep/order-prep.types.ts. */
export type OrderPrepTaskRole = 'picker' | 'packer';
export type OrderPrepTaskStatus = 'assigned' | 'in_progress' | 'completed';

export interface OrderPrepSession {
  id: string;
  totalParts: number;
  pickersNeeded: number;
  packersNeeded: number;
  packingDelayMinutes: number;
  pickingStartedAt: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface OrderPrepSessionWithTasks extends OrderPrepSession {
  tasks: OrderPrepTask[];
}

export interface OrderPrepTask {
  id: string;
  sessionId: string;
  role: OrderPrepTaskRole;
  assignedToUserId: string;
  status: OrderPrepTaskStatus;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export const STATUS_LABELS: Record<OrderPrepTaskStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
};

import { apiRequest } from './client';

export type OpenPoolTaskStatus = 'open' | 'claimed' | 'completed';
export type TaskPriority = 'normal' | 'high' | 'urgent';

export type OpenPoolTaskSourceType = 'reception' | 'seller_stock_pallet';

export interface OpenPoolTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  createdByUserId: string;
  targetUserId: string | null;
  claimedByUserId: string | null;
  status: OpenPoolTaskStatus;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  /** Admin-attached at creation, optional. */
  creationPhotoUrl: string | null;
  creationComment: string | null;
  /** Staff-attached at completion. */
  completionPhotoUrl: string | null;
  completionComment: string | null;
  sourceType: OpenPoolTaskSourceType | null;
  sourceId: string | null;
}

export interface CreateOpenPoolTaskInput {
  title: string;
  targetUserId?: string;
  description?: string;
  priority?: TaskPriority;
  creationPhotoUrl?: string;
  creationComment?: string;
}

export function fetchAllOpenPoolTasks(token: string) {
  return apiRequest<OpenPoolTask[]>('/open-pool-tasks', { token });
}

export function createOpenPoolTask(token: string, input: CreateOpenPoolTaskInput) {
  return apiRequest<OpenPoolTask>('/open-pool-tasks', { method: 'POST', token, body: input });
}

export interface DispatchTaskItemInput {
  id: string;
  comment: string;
}

export interface DispatchItemResult {
  id: string;
  success: boolean;
  error?: string;
}

/** Dispatches selected receptions as Open Pool tasks — see ReceptionsPage's DeliveriesSection. */
export function dispatchReceptionsAsTasks(token: string, items: DispatchTaskItemInput[], targetUserId?: string) {
  return apiRequest<DispatchItemResult[]>('/open-pool-tasks/dispatch-receptions', {
    method: 'POST',
    token,
    body: { items, targetUserId },
  });
}

/** Dispatches selected Seller Stock pallets as Open Pool tasks — see SellerStockPage's SellerStockSection. */
export function dispatchPalletsAsTasks(token: string, items: DispatchTaskItemInput[], targetUserId?: string) {
  return apiRequest<DispatchItemResult[]>('/open-pool-tasks/dispatch-pallets', {
    method: 'POST',
    token,
    body: { items, targetUserId },
  });
}

import { type TaskPriority } from '../tasks/task-priority';

export type OpenPoolTaskStatus = 'open' | 'claimed' | 'completed';
export type OpenPoolTaskSourceType = 'reception' | 'seller_stock_pallet';

export interface OpenPoolTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  createdByUserId: string;
  /** Set means only this staff member can see/claim it — null means broadcast to everyone, first to claim wins. */
  targetUserId: string | null;
  claimedByUserId: string | null;
  status: OpenPoolTaskStatus;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  /** Admin-attached at creation, optional. */
  creationPhotoUrl: string | null;
  creationComment: string | null;
  /** Staff-attached at completion — required. */
  completionPhotoUrl: string | null;
  completionComment: string | null;
  /** Set when dispatched from an existing Reception/SellerStockPallet rather than typed from scratch — see OpenPoolService. */
  sourceType: OpenPoolTaskSourceType | null;
  sourceId: string | null;
}

export interface DispatchItemResult {
  id: string;
  success: boolean;
  error?: string;
}

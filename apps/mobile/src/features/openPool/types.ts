/** Mirrors packages/backend/src/open-pool/open-pool.types.ts. */
export type OpenPoolTaskStatus = 'open' | 'claimed' | 'completed';
export type TaskPriority = 'normal' | 'high' | 'urgent';

export interface OpenPoolTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  createdByUserId: string;
  claimedByUserId: string | null;
  status: OpenPoolTaskStatus;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
}

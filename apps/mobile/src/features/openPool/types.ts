/** Mirrors packages/backend/src/open-pool/open-pool.types.ts. */
export type OpenPoolTaskStatus = 'open' | 'claimed' | 'completed';
export type TaskPriority = 'normal' | 'high' | 'urgent';

export interface OpenPoolTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  createdByUserId: string;
  /** Set means only this staff member can see/claim it — null means broadcast to everyone. */
  targetUserId: string | null;
  claimedByUserId: string | null;
  status: OpenPoolTaskStatus;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  /** Admin-attached at creation, optional — shown automatically once claimed. */
  creationPhotoUrl: string | null;
  creationComment: string | null;
  /** Staff-attached at completion — required. */
  completionPhotoUrl: string | null;
  completionComment: string | null;
}

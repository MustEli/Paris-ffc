import { type TaskPriority } from '../tasks/task-priority';

export type OpenPoolTaskStatus = 'open' | 'claimed' | 'completed';

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

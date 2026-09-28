import { apiRequest } from './client';

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

export interface CreateOpenPoolTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
}

export function fetchAllOpenPoolTasks(token: string) {
  return apiRequest<OpenPoolTask[]>('/open-pool-tasks', { token });
}

export function createOpenPoolTask(token: string, input: CreateOpenPoolTaskInput) {
  return apiRequest<OpenPoolTask>('/open-pool-tasks', { method: 'POST', token, body: input });
}

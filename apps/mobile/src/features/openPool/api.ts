import { apiRequest } from '../../core/api/client';
import { type OpenPoolTask } from './types';

export function fetchOpenPoolTasks(token: string) {
  return apiRequest<OpenPoolTask[]>('/open-pool-tasks/open', { token });
}

export function fetchMyOpenPoolTasks(token: string) {
  return apiRequest<OpenPoolTask[]>('/open-pool-tasks/mine', { token });
}

export function claimOpenPoolTask(token: string, id: string) {
  return apiRequest<OpenPoolTask>(`/open-pool-tasks/${id}/claim`, { method: 'POST', token });
}

export function completeOpenPoolTask(token: string, id: string) {
  return apiRequest<OpenPoolTask>(`/open-pool-tasks/${id}/complete`, { method: 'POST', token });
}

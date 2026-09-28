import { apiRequest } from '../../core/api/client';
import { type FloorTaskCategory, type FloorTaskLog } from './types';

export interface EndFloorTaskInput {
  count?: number;
  countExtra?: number;
  zone?: string;
  comment?: string;
  photoUrls?: string[];
}

export function startFloorTask(token: string, category: FloorTaskCategory) {
  return apiRequest<FloorTaskLog>('/floor-tasks/start', { method: 'POST', token, body: { category } });
}

export function endFloorTask(token: string, id: string, input: EndFloorTaskInput) {
  return apiRequest<FloorTaskLog>(`/floor-tasks/${id}/end`, { method: 'POST', token, body: input });
}

/** Null when nothing is currently open — a normal state, not an error. */
export function fetchMyOpenFloorTask(token: string) {
  return apiRequest<FloorTaskLog | null>('/floor-tasks/mine/open', { token });
}

export function fetchMyFloorTasks(token: string) {
  return apiRequest<FloorTaskLog[]>('/floor-tasks/mine', { token });
}

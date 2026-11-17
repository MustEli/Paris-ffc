import { apiRequest } from '../../core/api/client';
import { type FloorTaskCategory, type FloorTaskLog } from './types';

export interface EndFloorTaskInput {
  count?: number;
  countExtra?: number;
  zone?: string;
  comment?: string;
  photoUrls?: string[];
  /** 'dispatch' category only. */
  scannedBarcode?: string;
}

export function startFloorTask(token: string, category: FloorTaskCategory) {
  return apiRequest<FloorTaskLog>('/floor-tasks/start', { method: 'POST', token, body: { category } });
}

export function endFloorTask(token: string, id: string, input: EndFloorTaskInput) {
  return apiRequest<FloorTaskLog>(`/floor-tasks/${id}/end`, { method: 'POST', token, body: input });
}

/** Pulled away for ad-hoc work mid-task — pausing (not ending) keeps duration reporting honest. */
export function pauseFloorTask(token: string, id: string) {
  return apiRequest<FloorTaskLog>(`/floor-tasks/${id}/pause`, { method: 'POST', token });
}

export function resumeFloorTask(token: string, id: string) {
  return apiRequest<FloorTaskLog>(`/floor-tasks/${id}/resume`, { method: 'POST', token });
}

/** "Never mind, I didn't mean to start this" — see FloorTasksService.cancel()'s doc comment for the 2-minute no-trace rule. */
export function cancelFloorTask(token: string, id: string) {
  return apiRequest<{ deleted: boolean }>(`/floor-tasks/${id}/cancel`, { method: 'POST', token });
}

/** Self-service pause with no task id needed — a no-op if nothing's open or it's already paused. Used by the global Home-icon leaving-guard, which doesn't know a specific task id. */
export function pauseMyFloorTask(token: string) {
  return apiRequest<void>('/floor-tasks/pause-mine', { method: 'POST', token });
}

/** Null when nothing is actively *running* — a normal state, not an error. A merely-paused task doesn't count here, see fetchMyOpenFloorTasks for the full open set. */
export function fetchMyOpenFloorTask(token: string) {
  return apiRequest<FloorTaskLog | null>('/floor-tasks/mine/open', { token });
}

/** Every currently-open task (running or paused) — at most 1 running + FLOOR_TASK_MAX_PAUSED paused. */
export function fetchMyOpenFloorTasks(token: string) {
  return apiRequest<FloorTaskLog[]>('/floor-tasks/mine/open-all', { token });
}

export function fetchMyFloorTasks(token: string) {
  return apiRequest<FloorTaskLog[]>('/floor-tasks/mine', { token });
}

import { apiRequest } from '../../core/api/client';
import { type PutAwayTask } from './types';

export interface AssignTaskInput {
  palletId: string;
  assignedToUserId: string;
  location: string;
}

export function listTasks(token: string) {
  return apiRequest<PutAwayTask[]>('/put-away-tasks', { token });
}

export function getTask(token: string, id: string) {
  return apiRequest<PutAwayTask>(`/put-away-tasks/${id}`, { token });
}

export function assignTask(token: string, input: AssignTaskInput) {
  return apiRequest<PutAwayTask>('/put-away-tasks', { method: 'POST', token, body: input });
}

export function startTask(token: string, id: string) {
  return apiRequest<PutAwayTask>(`/put-away-tasks/${id}/start`, { method: 'POST', token });
}

export function completeTask(token: string, id: string) {
  return apiRequest<PutAwayTask>(`/put-away-tasks/${id}/complete`, { method: 'POST', token });
}

export function reportIssue(token: string, id: string, description: string) {
  return apiRequest<PutAwayTask>(`/put-away-tasks/${id}/report-issue`, {
    method: 'POST',
    token,
    body: { description },
  });
}

export function reassignTask(token: string, id: string, assignedToUserId: string, location?: string) {
  return apiRequest<PutAwayTask>(`/put-away-tasks/${id}/reassign`, {
    method: 'POST',
    token,
    body: { assignedToUserId, location },
  });
}

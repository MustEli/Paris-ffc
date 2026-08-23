import { apiRequest } from '../../core/api/client';
import {
  type OrderPrepSession,
  type OrderPrepSessionWithTasks,
  type OrderPrepTask,
  type OrderPrepTaskRole,
} from './types';

export function listSessions(token: string) {
  return apiRequest<OrderPrepSession[]>('/order-prep/sessions', { token });
}

export function getSession(token: string, id: string) {
  return apiRequest<OrderPrepSessionWithTasks>(`/order-prep/sessions/${id}`, { token });
}

export function createSession(token: string, totalParts: number) {
  return apiRequest<OrderPrepSession>('/order-prep/sessions', {
    method: 'POST',
    token,
    body: { totalParts },
  });
}

export function assignTask(
  token: string,
  sessionId: string,
  assignedToUserId: string,
  role: OrderPrepTaskRole,
) {
  return apiRequest<OrderPrepTask>(`/order-prep/sessions/${sessionId}/tasks`, {
    method: 'POST',
    token,
    body: { assignedToUserId, role },
  });
}

export function listTasks(token: string) {
  return apiRequest<OrderPrepTask[]>('/order-prep/tasks', { token });
}

export function getTask(token: string, id: string) {
  return apiRequest<OrderPrepTask>(`/order-prep/tasks/${id}`, { token });
}

export function startTask(token: string, id: string) {
  return apiRequest<OrderPrepTask>(`/order-prep/tasks/${id}/start`, { method: 'POST', token });
}

export function completeTask(token: string, id: string) {
  return apiRequest<OrderPrepTask>(`/order-prep/tasks/${id}/complete`, { method: 'POST', token });
}

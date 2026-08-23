import { apiRequest } from './client';

/** Mirrors packages/backend/src/users/user.types.ts PublicUser. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'management';
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: PublicUser['role'];
}

/** Admin/management only on the backend — used for the "assign to staff" picker and User Management. */
export function listUsers(token: string, role?: PublicUser['role']) {
  const query = role ? `?role=${role}` : '';
  return apiRequest<PublicUser[]>(`/users${query}`, { token });
}

export function getUser(token: string, id: string) {
  return apiRequest<PublicUser>(`/users/${id}`, { token });
}

/** Admin only on the backend. */
export function createUser(token: string, input: CreateUserInput) {
  return apiRequest<PublicUser>('/users', { method: 'POST', token, body: input });
}

/** Admin only on the backend. 400 if removing yourself or the last admin. */
export function removeUser(token: string, id: string) {
  return apiRequest<{ success: boolean }>(`/users/${id}`, { method: 'DELETE', token });
}

/** Admin only on the backend. 400 if it's the sole admin demoting themselves. */
export function changeUserRole(token: string, id: string, role: PublicUser['role']) {
  return apiRequest<PublicUser>(`/users/${id}/role`, { method: 'POST', token, body: { role } });
}

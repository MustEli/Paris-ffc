import { apiRequest } from './client';

/** Mirrors packages/backend/src/users/user.types.ts PublicUser. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'management';
}

/** Admin/management only on the backend — used for the "assign to staff" picker. */
export function listUsers(token: string, role?: PublicUser['role']) {
  const query = role ? `?role=${role}` : '';
  return apiRequest<PublicUser[]>(`/users${query}`, { token });
}

import { apiRequest } from './client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'management';
}

export function fetchStaffUsers(token: string) {
  return apiRequest<PublicUser[]>('/users?role=staff', { token });
}

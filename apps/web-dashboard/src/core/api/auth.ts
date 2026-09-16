import { apiRequest } from './client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'management';
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
}

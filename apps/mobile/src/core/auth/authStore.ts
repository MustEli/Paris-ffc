import { create } from 'zustand';

import { apiRequest } from '../api/client';

/**
 * Roles from the requirements doc (Feature 0 — Fundamentals):
 * Staff, Admin, Management. IT/Infra is a deployment concern, not an
 * app-facing role, so it isn't represented here. Mirrors the backend's
 * Role type (packages/backend/src/users/user.types.ts) — will collapse
 * into one shared definition once packages/shared exists.
 */
export type Role = 'staff' | 'admin' | 'management';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  token: string | null;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * NOTE: the token/user only live in memory — nothing is persisted, so a
 * full app reload requires logging in again. Fine for now; add
 * expo-secure-store-backed persistence when that friction actually
 * matters, not before.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  token: null,
  user: null,
  error: null,

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      set({ status: 'authenticated', token: response.accessToken, user: response.user, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ status: 'error', token: null, user: null, error: message });
      throw err;
    }
  },

  logout: () => set({ status: 'idle', token: null, user: null, error: null }),
}));

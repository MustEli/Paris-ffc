import { create } from 'zustand';

/**
 * Roles from the requirements doc (Feature 0 — Fundamentals):
 * Staff, Admin, Management. IT/Infra is a deployment concern, not an
 * app-facing role, so it isn't represented here.
 */
export type Role = 'staff' | 'admin' | 'management';

interface AuthState {
  role: Role | null;
  /**
   * TEMPORARY MOCK LOGIN.
   * There is no backend yet, so "logging in" just sets a role locally —
   * no credentials, no token, nothing persisted. Replace this with a real
   * call into core/api once the backend's auth endpoint exists (see
   * docs/architecture.md build roadmap, step 3).
   */
  login: (role: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  login: (role) => set({ role }),
  logout: () => set({ role: null }),
}));

/**
 * Shared between AuthContext (owns these keys) and api/client.ts (needs
 * to clear them on a 401 without importing AuthContext itself, which
 * would create a circular import: client.ts -> AuthContext.tsx ->
 * api/auth.ts -> client.ts).
 */
export const TOKEN_STORAGE_KEY = 'elno-admin-token';
export const USER_STORAGE_KEY = 'elno-admin-user';

/** Dispatched by api/client.ts whenever any request comes back 401 — AuthContext listens and logs out. */
export const UNAUTHORIZED_EVENT = 'elno:unauthorized';

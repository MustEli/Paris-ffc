/**
 * Roles from the requirements doc (Feature 0 — Fundamentals): Staff,
 * Admin, Management. IT/Infra is a deployment concern, not an
 * app-facing role, so it isn't represented here — matches
 * apps/mobile/src/core/auth/authStore.ts's Role type.
 */
export type Role = 'staff' | 'admin' | 'management';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/** User shape safe to send to clients — never includes passwordHash. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

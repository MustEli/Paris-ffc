import { apiRequest } from '../../core/api/client';

/** Mirrors packages/backend/src/shifts/shift.types.ts. */
export interface Shift {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
}

/** lunch is unpaid (subtracted from worked hours); short is paid and capped at SHORT_BREAK_LIMIT_MS per shift. */
export type BreakType = 'lunch' | 'short';

/** Mirrors the backend's SHORT_BREAK_LIMIT_MS (shift.types.ts) — 20 minutes. */
export const SHORT_BREAK_LIMIT_MS = 20 * 60_000;

export interface ShiftStatus {
  active: boolean;
  shiftId: string | null;
  startedAt: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
  breakType: BreakType | null;
  shortBreakUsedMs: number;
  shortBreakRemainingMs: number;
}

export interface Break {
  id: string;
  shiftId: string;
  type: BreakType;
  startedAt: string;
  endedAt: string | null;
}

export function fetchShiftStatus(token: string) {
  return apiRequest<ShiftStatus>('/shifts/status', { token });
}

export function startShift(token: string) {
  return apiRequest<Shift>('/shifts/start', { method: 'POST', token });
}

export function endShift(token: string) {
  return apiRequest<Shift>('/shifts/end', { method: 'POST', token });
}

/** Sent every ~15 min while a shift is active and the app is open — see useShiftHeartbeat. */
export function sendHeartbeat(token: string) {
  return apiRequest<{ ok: true }>('/shifts/heartbeat', { method: 'POST', token });
}

export function startBreak(token: string, type: BreakType) {
  return apiRequest<Break>('/shifts/break/start', { method: 'POST', token, body: { type } });
}

export function endBreak(token: string) {
  return apiRequest<Break>('/shifts/break/end', { method: 'POST', token });
}

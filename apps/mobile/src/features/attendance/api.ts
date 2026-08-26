import { apiRequest } from '../../core/api/client';

/** Mirrors packages/backend/src/shifts/shift.types.ts. */
export interface Shift {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
}

export interface ShiftStatus {
  active: boolean;
  shiftId: string | null;
  startedAt: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
}

export interface Break {
  id: string;
  shiftId: string;
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

export function startBreak(token: string) {
  return apiRequest<Break>('/shifts/break/start', { method: 'POST', token });
}

export function endBreak(token: string) {
  return apiRequest<Break>('/shifts/break/end', { method: 'POST', token });
}

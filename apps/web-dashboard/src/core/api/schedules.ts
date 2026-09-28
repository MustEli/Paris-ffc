import { apiRequest } from './client';

/** Mirrors packages/backend/src/schedules/schedule.types.ts. */
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

export interface StaffSchedule {
  userId: string;
  workingDays: Weekday[];
  shiftStartTime: string;
  shiftEndTime: string;
  requiredWorkingHours: number;
  paidBreakStartTime: string | null;
  lunchBreakStartTime: string | null;
  lunchBreakDurationMinutes: number;
  updatedAt: string;
}

export interface SetScheduleInput {
  workingDays: Weekday[];
  shiftStartTime: string;
  shiftEndTime: string;
  requiredWorkingHours: number;
  paidBreakStartTime?: string;
  lunchBreakStartTime?: string;
  lunchBreakDurationMinutes?: number;
}

/** Null means no schedule configured for that staff member yet. */
export function fetchSchedule(token: string, userId: string) {
  return apiRequest<StaffSchedule | null>(`/schedules/${userId}`, { token });
}

export function setSchedule(token: string, userId: string, input: SetScheduleInput) {
  return apiRequest<StaffSchedule>(`/schedules/${userId}`, { method: 'PUT', token, body: input });
}

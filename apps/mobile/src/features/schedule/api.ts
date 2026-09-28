import { apiRequest } from '../../core/api/client';

/** Mirrors packages/backend/src/schedules/schedule.types.ts. */
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

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
  /** Reminder anchor only — see backend schema.prisma's StaffSchedule doc comment. */
  paidBreakStartTime: string | null;
  lunchBreakStartTime: string | null;
  lunchBreakDurationMinutes: number;
  updatedAt: string;
}

/** Null means "no schedule configured for this staff member yet" — a normal state, not an error. */
export function fetchMySchedule(token: string) {
  return apiRequest<StaffSchedule | null>('/schedules/me', { token });
}

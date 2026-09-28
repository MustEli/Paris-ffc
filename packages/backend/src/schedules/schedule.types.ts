export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** "HH:MM", 24h — see schema.prisma's StaffSchedule doc comment for the UTC-as-local simplification. */
export const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface StaffSchedule {
  userId: string;
  workingDays: Weekday[];
  shiftStartTime: string;
  shiftEndTime: string;
  requiredWorkingHours: number;
  /** Reminder anchor only — see schema.prisma. Duration is always SHORT_BREAK_LIMIT_MS, not stored here. */
  paidBreakStartTime: string | null;
  lunchBreakStartTime: string | null;
  lunchBreakDurationMinutes: number;
  updatedAt: string;
}

/** Minutes since local midnight — see HH_MM_PATTERN. */
export function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Matches Feature 1 (Shift Attendance) in the requirements doc: a shift is
 * "active" from Start Shift until End Shift, one active shift per user at
 * a time. The 7-hour completion-notification logic from the doc isn't
 * implemented yet — that's push-notification territory (roadmap step 5),
 * not needed to prove the start/end/status vertical slice.
 */
export interface Shift {
  id: string;
  userId: string;
  startedAt: string; // ISO 8601
  endedAt: string | null;
}

/** See schema.prisma's Break model doc comment: lunch is unpaid, short is paid and capped. */
export type BreakType = 'lunch' | 'short';

/** 20 minutes, cumulative across the whole shift — see shifts.service.ts. */
export const SHORT_BREAK_LIMIT_MS = 20 * 60_000;

export interface ShiftStatus {
  active: boolean;
  shiftId: string | null;
  startedAt: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
  breakType: BreakType | null;
  /** Cumulative "short" break time used this shift, including any currently in progress. */
  shortBreakUsedMs: number;
  /** SHORT_BREAK_LIMIT_MS minus shortBreakUsedMs, floored at 0. */
  shortBreakRemainingMs: number;
}

/**
 * A break within a shift — see schema.prisma's Break model doc comment
 * for why this is its own thing rather than pausing the shift, and for
 * the lunch-vs-short distinction.
 */
export interface Break {
  id: string;
  shiftId: string;
  type: BreakType;
  startedAt: string;
  endedAt: string | null;
}

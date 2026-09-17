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

/**
 * Lunch has no real cap (unpaid, staff can take as long as needed) — this
 * is purely a *display* target so the UI can show "remaining" for lunch
 * the same way it does for Short Break, per explicit request. Unlike
 * SHORT_BREAK_LIMIT_MS, nothing is enforced against this: it's never
 * blocked, never auto-ended, and going over it (negative remaining) is
 * expected and fine.
 */
export const LUNCH_BREAK_SUGGESTED_DURATION_MS = 60 * 60_000;

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
  /**
   * Only meaningful while onBreak && breakType === 'lunch'. Same shape
   * as shortBreakRemainingMs, but — unlike that one — deliberately NOT
   * floored at 0: lunch has no real cap, so going past
   * LUNCH_BREAK_SUGGESTED_DURATION_MS is expected and shows as negative
   * ("over by") rather than getting clamped to zero like Short Break's
   * real, enforced limit.
   */
  lunchBreakRemainingMs: number | null;
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

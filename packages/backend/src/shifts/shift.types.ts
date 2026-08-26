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

export interface ShiftStatus {
  active: boolean;
  shiftId: string | null;
  startedAt: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
}

/**
 * A lunch break within a shift — see schema.prisma's Break model doc
 * comment for why this is its own thing rather than pausing the shift.
 */
export interface Break {
  id: string;
  shiftId: string;
  startedAt: string;
  endedAt: string | null;
}

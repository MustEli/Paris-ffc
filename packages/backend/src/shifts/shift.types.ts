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
}

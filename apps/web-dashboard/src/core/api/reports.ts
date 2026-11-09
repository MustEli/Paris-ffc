import { apiRequest } from './client';

/** Mirrors packages/backend/src/reports/reports.types.ts's AdminDashboardReport. */
export interface AdminDashboardReport {
  date: string;
  liveSummary: {
    staffOnShiftCount: number;
    totalStaffCount: number;
    palletsPendingReviewCount: number;
    openPutAwayTaskCount: number;
    activeOrderPrepSessionCount: number;
  };
  today: {
    receptionsLoggedCount: number;
    receptionsCompletedCount: number;
    palletsLoggedCount: number;
    putAwayCompletedCount: number;
    orderPrepSessionsCreatedCount: number;
  };
  staff: {
    userId: string;
    userName: string;
    onShift: boolean;
    shiftStartedAt: string | null;
    onBreak: boolean;
    breakType: 'lunch' | 'short' | null;
    breakStartedAt: string | null;
    /** Only meaningful while onBreak && breakType === 'short'. */
    shortBreakRemainingMs: number | null;
    /** Only meaningful while onBreak && breakType === 'lunch'. Display-only target, can go negative. */
    lunchBreakRemainingMs: number | null;
    shiftsToday: number;
    hoursWorkedToday: number;
    putAwayCompletedToday: number;
    orderPrepCompletedToday: number;
  }[];
}

export function fetchAdminDashboard(token: string) {
  return apiRequest<AdminDashboardReport>('/reports/admin-dashboard', { token });
}

/** Mirrors packages/backend/src/reports/reports.types.ts's AttendanceReport. */
export interface AttendanceReportRow {
  userId: string;
  userName: string;
  totalShifts: number;
  /** Net of break time. Only counts completed (clocked-out) shifts. */
  totalHoursWorked: number;
}

export interface AttendanceReport {
  /** Sorted by totalHoursWorked, descending. */
  rows: AttendanceReportRow[];
}

export function fetchAttendanceReport(token: string) {
  return apiRequest<AttendanceReport>('/reports/attendance', { token });
}

/** Mirrors packages/backend/src/reports/reports.types.ts's StaffHistoryReport. */
export interface StaffHistoryDay {
  /** 0 on a day outside the staff member's configured working days (or with no schedule configured at all). */
  plannedHours: number;
  /** Net of lunch break. Only from completed (clocked-out) shifts that started on this day. */
  actualHours: number;
}

export interface StaffHistoryRow {
  userId: string;
  userName: string;
  /** Keyed by "YYYY-MM-DD" — every key in StaffHistoryReport.days is present here. */
  days: Record<string, StaffHistoryDay>;
}

export interface StaffHistoryReport {
  /** "YYYY-MM-DD", ascending, from the app's first-ever completed shift to today. Empty if no shift has ever completed. */
  days: string[];
  staff: StaffHistoryRow[];
}

export function fetchStaffHistory(token: string) {
  return apiRequest<StaffHistoryReport>('/reports/staff-history', { token });
}

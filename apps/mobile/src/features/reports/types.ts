/** Mirrors packages/backend/src/reports/reports.types.ts. */
import { type ReceptionCategory } from '../reception/types';

export interface OverviewReport {
  staffOnShiftCount: number;
  totalStaffCount: number;
  palletsPendingReviewCount: number;
  openPutAwayTaskCount: number;
  activeOrderPrepSessionCount: number;
  generatedAt: string;
}

export interface AttendanceReportRow {
  userId: string;
  userName: string;
  totalShifts: number;
  totalHoursWorked: number;
}

export interface AttendanceReport {
  rows: AttendanceReportRow[];
}

export interface ReceptionCategoryStats {
  category: ReceptionCategory;
  totalCount: number;
  completedCount: number;
  averageProcessingMinutes: number | null;
  flaggedCount: number;
}

export interface ReceptionReport {
  categories: ReceptionCategoryStats[];
}

export interface PutAwayReport {
  totalTasks: number;
  completedCount: number;
  issueReportedCount: number;
  averageCompletionMinutes: number | null;
}

export interface OrderPrepRoleStats {
  totalCount: number;
  completedCount: number;
  averageDurationMinutes: number | null;
}

export interface OrderPrepReport {
  totalSessions: number;
  pickerTasks: OrderPrepRoleStats;
  packerTasks: OrderPrepRoleStats;
}

export interface StaffStatus {
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
}

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
  staff: StaffStatus[];
}

import { type ReceptionCategory } from '../receptions/reception.types';

/**
 * Feature 0's Management interface requirement ("Reporting tools and
 * visual analytics dashboards" / "Management dashboards aggregate this
 * data to visualize advancement and efficiency metrics") plus the
 * per-feature "Performance Analytics" call-outs in Reception (Feature 2,
 * average processing time per category), Put-Away (Feature 4, task
 * duration segmented by outcome), and Order Prep (Feature 5, throughput
 * metrics) — this module is where all of that converges. Everything
 * here is computed from data already being recorded by other features;
 * no new domain concepts, matching the vertical-slice approach used
 * throughout this project.
 */
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
  /** Only counts completed (clocked-out) shifts — an in-progress shift's duration isn't known yet. */
  totalHoursWorked: number;
}

export interface AttendanceReport {
  /** Sorted by totalHoursWorked, descending. */
  rows: AttendanceReportRow[];
}

export interface ReceptionCategoryStats {
  category: ReceptionCategory;
  totalCount: number;
  completedCount: number;
  /** null when no completed entries exist yet for this category. */
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
  /**
   * Deliberately not a parts/hr "actual throughput" figure — that would
   * need per-task part-count capture, which order-prep.service.ts's
   * own scope-cut comment says isn't built. Task duration is the closest
   * honest proxy available from data actually being recorded.
   */
}

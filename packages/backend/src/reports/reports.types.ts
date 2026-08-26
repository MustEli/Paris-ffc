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

export interface StaffStatus {
  userId: string;
  userName: string;
  onShift: boolean;
  /** null when not currently on shift. */
  shiftStartedAt: string | null;
  shiftsToday: number;
  /** Only counts shifts that have already ended today — an in-progress shift's duration isn't known yet. */
  hoursWorkedToday: number;
  putAwayCompletedToday: number;
  orderPrepCompletedToday: number;
}

/**
 * Admin's home-screen dashboard — "whatever happening right now,"
 * distinct from Management's all-time Dashboard. Two different time
 * scopes on purpose: `liveSummary` is current-state (doesn't reset —
 * a pending pallet is pending regardless of what day it is),
 * `today`/`staff` are scoped to the calendar day so the numbers reset
 * each morning. "Today" uses the server's UTC calendar day — if the
 * warehouse isn't near UTC, the boundary won't line up with local
 * midnight; a real timezone setting would fix that if it ever matters.
 */
export interface AdminDashboardReport {
  /** The server's current UTC calendar date, YYYY-MM-DD. */
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
  /** Sorted on-shift-first, then alphabetically. */
  staff: StaffStatus[];
}

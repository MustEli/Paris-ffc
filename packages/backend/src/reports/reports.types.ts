import { type FloorTaskCategory } from '../floor-tasks/floor-task.types';
import { type ReceptionCategory } from '../receptions/reception.types';
import { type Weekday } from '../schedules/schedule.types';
import { type PalletConditionFlag } from '../seller-stock/seller-stock.types';

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
  /** Net of break time. Only counts completed (clocked-out) shifts — an in-progress shift's duration isn't known yet. */
  totalHoursWorked: number;
}

export interface AttendanceReport {
  /** Sorted by totalHoursWorked, descending. */
  rows: AttendanceReportRow[];
}

/** Table 3's day-by-day/Cumulative breakdown shape lives further below as StaffActivityBreakdown — replaced the old plannedHours/actualHours/floorTaskHours/... shape per the Nov 2026 table redesign. */

export type ReportGranularity = 'day' | 'week' | 'month' | 'quarter';

export interface ReceptionVolumeReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; total: number; byCategory: Partial<Record<ReceptionCategory, number>> }[];
  /** (most recent period's total − previous period's total) / previous period's total × 100. Null if fewer than 2 periods have data, or the previous period's total was 0. */
  percentChangeVsPreviousPeriod: number | null;
  /** Total deliveries per weekday across the whole selected range — a plain sum, not divided by week count (see ReportsService.receptionVolume's doc comment for why). */
  byWeekday: { weekday: Weekday; total: number }[];
}

export interface ReceptionDurationReport {
  granularity: ReportGranularity;
  /** Average ReceptionTask worked-minutes per period — 'completed' outcomes only. */
  byPeriod: { period: string; averageMinutes: number | null; completedCount: number }[];
  byCategory: { category: ReceptionCategory; averageMinutes: number | null; completedCount: number }[];
  byStaff: { userId: string; userName: string; averageMinutes: number | null; completedCount: number }[];
}

export interface SellerStockQualityReport {
  granularity: ReportGranularity;
  bySeller: { sellerName: string; totalCount: number; problemCount: number; problemRatePercent: number }[];
  /** A pallet can count toward more than one flag — counts aren't mutually exclusive. */
  byProblemType: { flag: PalletConditionFlag; count: number }[];
  byPeriod: { period: string; totalCount: number; problemCount: number; problemRatePercent: number }[];
  overweight: {
    bySeller: { sellerName: string; totalCount: number; overweightCount: number; overweightRatePercent: number }[];
    byPeriod: { period: string; totalCount: number; overweightCount: number; overweightRatePercent: number }[];
  };
}

export interface ReceptionSourcesReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; byTransporter: { transporterCompany: string; quantity: number }[] }[];
  /** Top 8 transporter companies by total quantity across the whole selected range — everything else folds into "Other". */
  topTransporters: { transporterCompany: string; totalQuantity: number }[];
}

export interface ReceptionReliabilityReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; unfinishedCount: number; totalCount: number; unfinishedRatePercent: number }[];
  byStaff: { userId: string; userName: string; unfinishedCount: number; totalCount: number; unfinishedRatePercent: number }[];
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

export type StaffActivityScope = 'live' | 'recent';
export type StaffActivityType =
  | 'floor_task'
  | 'reception'
  | 'open_pool'
  | 'directive'
  | 'lunch_break'
  | 'short_break'
  | 'idle';

/**
 * Powers the web dashboard's "Staff Activity" section — a merge of the
 * 4 different "someone is actively doing something" sources in this
 * app (Floor Task, the Reception timer, a claimed Open Pool task, an
 * acknowledged Directive), since none of them alone told the full
 * story of "what is everyone doing right now" (that used to be just
 * Floor Tasks). `scope: 'live'` is the 4 sources' in-progress rows
 * (oldest-started first) PLUS one row for every other on-shift staff
 * member not already covered by one of those 4 — 'lunch_break' /
 * 'short_break' if they're on a break, 'idle' otherwise (on shift, no
 * task, no break). `scope: 'recent'` is the original 4 sources' most
 * recently *finished* rows instead (newest-first, capped — see
 * ReportsService.staffActivity's RECENT_LIMIT); breaks/idle periods
 * aren't tracked historically, so they never appear under 'recent'.
 * This is also the only place a completed 'dispatch' Floor Task's
 * scannedBarcode becomes visible to Admin (it disappears from 'live'
 * the instant it ends). Only one of the type-specific fields below is
 * ever populated, per `type` — same "raw, typed, category-specific
 * fields" convention as ActiveFloorTask/ReceptionCategoryStats rather
 * than a computed label string, so the frontend decides how to display
 * each type.
 */
export interface StaffActivityEntry {
  type: StaffActivityType;
  id: string;
  userId: string;
  userName: string;
  startedAt: string;
  /** null while still live. */
  endedAt: string | null;
  /** ms; null while still live. */
  durationMs: number | null;
  /** type === 'floor_task' only. */
  floorTaskCategory?: FloorTaskCategory;
  /** type === 'floor_task' && floorTaskCategory === 'dispatch' only. */
  scannedBarcode?: string | null;
  /** type === 'floor_task' && scope 'recent' only — a floor task cancelled 2+ minutes after start still shows up here (cancelling that late keeps the row, just excluded from worked-hours totals), distinguished from a normal completion. Undefined for 'live' entries, where a floor task is never in an ended state at all. */
  floorTaskOutcome?: 'completed' | 'cancelled';
  /** type === 'reception' only — null while still live (only set once ended). */
  receptionOutcome?: 'completed' | 'unfinished' | null;
  /** type === 'open_pool' only. */
  openPoolTitle?: string;
  openPoolDescription?: string | null;
  /** type === 'directive' only. */
  directiveType?: string;
  directiveMessage?: string;
  /** type === 'lunch_break' | 'short_break' only — same meaning as StaffStatus.lunchBreakRemainingMs/shortBreakRemainingMs (lunch has no real cap, can go negative). */
  breakRemainingMs?: number | null;
  /** This person's total clocked shift time today (net of lunch break) — same figure as StaffStatus.hoursWorkedToday, repeated on every one of their rows so admin can compare a specific activity's duration against their overall day without cross-referencing the Staff table. */
  hoursWorkedToday: number;
}

export interface StaffActivityReport {
  entries: StaffActivityEntry[];
}

export interface StaffStatus {
  userId: string;
  userName: string;
  onShift: boolean;
  /** null when not currently on shift. */
  shiftStartedAt: string | null;
  /** Only meaningful when onShift is true. */
  onBreak: boolean;
  /** null when onBreak is false. */
  breakType: 'lunch' | 'short' | null;
  /** null when onBreak is false. */
  breakStartedAt: string | null;
  /** null unless breakType is 'short' — same meaning as ShiftStatus.shortBreakRemainingMs. */
  shortBreakRemainingMs: number | null;
  /** null unless breakType is 'lunch' — same meaning as ShiftStatus.lunchBreakRemainingMs (not a real cap, can go negative). */
  lunchBreakRemainingMs: number | null;
  shiftsToday: number;
  /** Net of break time, and only counts shifts that have already ended today — an in-progress shift's duration isn't known yet. */
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

export type BreakKind = 'lunch' | 'short';
export type IdleKind = 'unclaimed' | 'off_shift';
export type OpenPoolBucketKind = 'directive' | 'general';

/**
 * One staff member's time breakdown for a single day (or a Cumulative
 * total across days) — shared shape for the web dashboard's "Staff"
 * table (table 2, today only) and "Staff History" table (table 3, one
 * of these per day plus a Cumulative), per the Nov 2026 table redesign.
 * Every *Ms field already has pause time subtracted out. The relationship
 * between fields:
 *   onlineMs  = claimedMs + idleMs.unclaimed
 *   claimedMs = sum(receptionMs) + sum(floorTaskMs) + sum(openPoolMs) + sum(breakMs)
 * idleMs.off_shift is NOT part of onlineMs (it's the gap between ending
 * a shift and starting a new one the same day, so by definition not
 * "online") — it's kept on this shape anyway since the UI's "Idle"
 * column shows both idle sub-kinds together. openPoolMs.directive is
 * Directive received->resolved time (shown inside the "Open-Pool"
 * column per the admin's own categorization — not a separate column).
 */
export interface StaffActivityBreakdown {
  /**
   * ms between now and today's planned shift-start time (that staff's
   * StaffSchedule.shiftStartTime for this day's weekday) — clamped to 0
   * if that time hasn't arrived yet. Null (not 0) when there's no
   * planned start to measure against at all — no StaffSchedule row, or
   * this weekday isn't in their workingDays — which the UI shows as an
   * alert instead of a duration.
   */
  plannedMs: number | null;
  onlineMs: number;
  claimedMs: number;
  receptionMs: Record<ReceptionCategory, number>;
  floorTaskMs: Record<FloorTaskCategory, number>;
  openPoolMs: Record<OpenPoolBucketKind, number>;
  breakMs: Record<BreakKind, number>;
  idleMs: Record<IdleKind, number>;
}

export interface StaffActivityBreakdownRow {
  userId: string;
  userName: string;
  breakdown: StaffActivityBreakdown;
}

/** Backs the web dashboard's "Staff" table (table 2) — today only. */
export interface StaffSummaryReport {
  staff: StaffActivityBreakdownRow[];
}

export interface StaffHistoryV2Row {
  userId: string;
  userName: string;
  /** Keyed by "YYYY-MM-DD" (UTC) — every key in StaffHistoryV2Report.days is present here, zeroed out for days with nothing recorded. */
  days: Record<string, StaffActivityBreakdown>;
  cumulative: StaffActivityBreakdown;
}

/** Backs the web dashboard's "Staff History" table (table 3) — the on-screen, day-grouped pivot view. */
export interface StaffHistoryV2Report {
  /** "YYYY-MM-DD" (UTC), ascending, from the app's first-ever completed shift to today. Empty if no shift has ever completed. */
  days: string[];
  staff: StaffHistoryV2Row[];
}

/** One staff-member/day row — backs the Staff History Excel export's long format (one row per staff per calendar day since they were added to the app, including zero-activity days). */
export interface StaffHistoryExportRow {
  userId: string;
  userName: string;
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  breakdown: StaffActivityBreakdown;
}

export interface StaffHistoryExportReport {
  rows: StaffHistoryExportRow[];
}

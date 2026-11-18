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

/** Mirrors packages/backend/src/reports/reports.types.ts's BreakKind/IdleKind/OpenPoolBucketKind/StaffActivityBreakdown. */
export type BreakKind = 'lunch' | 'short';
export type IdleKind = 'unclaimed' | 'off_shift';
export type OpenPoolBucketKind = 'directive' | 'general';

/**
 * One staff member's time breakdown for a single day (or a Cumulative
 * total) — shared shape for the "Staff" table (table 2, today only)
 * and "Staff History" table (table 3, one per day + Cumulative).
 *   onlineMs  = claimedMs + idleMs.unclaimed
 *   claimedMs = sum(receptionMs) + sum(floorTaskMs) + sum(openPoolMs) + sum(breakMs)
 * idleMs.off_shift is NOT part of onlineMs. openPoolMs.directive is
 * Directive received->resolved time shown inside the Open-Pool column.
 */
export interface StaffActivityBreakdown {
  /** ms until/since today's planned shift-start; null when there's no planned start to measure against (no schedule, or this weekday isn't a working day) — show an alert instead of a duration. */
  plannedMs: number | null;
  onlineMs: number;
  claimedMs: number;
  receptionMs: Record<ReceptionCategory, number>;
  floorTaskMs: Record<string, number>;
  openPoolMs: Record<OpenPoolBucketKind, number>;
  breakMs: Record<BreakKind, number>;
  idleMs: Record<IdleKind, number>;
}

export interface StaffActivityBreakdownRow {
  userId: string;
  userName: string;
  breakdown: StaffActivityBreakdown;
}

export interface StaffSummaryReport {
  staff: StaffActivityBreakdownRow[];
}

export function fetchStaffSummary(token: string) {
  return apiRequest<StaffSummaryReport>('/reports/staff-summary', { token });
}

export interface StaffHistoryV2Row {
  userId: string;
  userName: string;
  /** Keyed by "YYYY-MM-DD" — every key in StaffHistoryV2Report.days is present here. */
  days: Record<string, StaffActivityBreakdown>;
  cumulative: StaffActivityBreakdown;
}

export interface StaffHistoryV2Report {
  /** "YYYY-MM-DD", ascending, from the app's first-ever shift to today. Empty if no shift has ever started. */
  days: string[];
  staff: StaffHistoryV2Row[];
}

export function fetchStaffHistory(token: string) {
  return apiRequest<StaffHistoryV2Report>('/reports/staff-history', { token });
}

export interface StaffHistoryExportRow {
  userId: string;
  userName: string;
  /** "YYYY-MM-DD". */
  date: string;
  breakdown: StaffActivityBreakdown;
}

export interface StaffHistoryExportReport {
  rows: StaffHistoryExportRow[];
}

export function fetchStaffHistoryExport(token: string) {
  return apiRequest<StaffHistoryExportReport>('/reports/staff-history-export', { token });
}

/** Mirrors packages/backend/src/reports/reports.types.ts's ReportGranularity + the 5 Reception Reports endpoints. */
export type ReportGranularity = 'day' | 'week' | 'month' | 'quarter';

export interface ReportDateRangeParams {
  granularity?: ReportGranularity;
  from?: string;
  to?: string;
}

function dateRangeQueryString(params?: ReportDateRangeParams): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const search = new URLSearchParams(entries as [string, string][]);
  return `?${search.toString()}`;
}

export type ReceptionCategory = 'return_parcels' | 'packaging_stock' | 'sellers_stock' | 'equipment_other';
type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface ReceptionVolumeReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; total: number; byCategory: Partial<Record<ReceptionCategory, number>> }[];
  /** Null if fewer than 2 periods have data, or the previous period's total was 0. */
  percentChangeVsPreviousPeriod: number | null;
  /** Total deliveries per weekday across the whole selected range — a plain sum, not divided by week count. */
  byWeekday: { weekday: Weekday; total: number }[];
}

export function fetchReceptionVolume(token: string, params?: ReportDateRangeParams) {
  return apiRequest<ReceptionVolumeReport>(`/reports/reception-volume${dateRangeQueryString(params)}`, { token });
}

export interface ReceptionDurationReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; averageMinutes: number | null; completedCount: number }[];
  byCategory: { category: ReceptionCategory; averageMinutes: number | null; completedCount: number }[];
  byStaff: { userId: string; userName: string; averageMinutes: number | null; completedCount: number }[];
}

export function fetchReceptionDuration(token: string, params?: ReportDateRangeParams) {
  return apiRequest<ReceptionDurationReport>(`/reports/reception-duration${dateRangeQueryString(params)}`, { token });
}

export type PalletConditionFlag = 'good' | 'overweight' | 'overloaded' | 'damaged' | 'location_name_needed' | 'other';

export interface SellerStockQualityReport {
  granularity: ReportGranularity;
  bySeller: { sellerName: string; totalCount: number; problemCount: number; problemRatePercent: number }[];
  byProblemType: { flag: PalletConditionFlag; count: number }[];
  byPeriod: { period: string; totalCount: number; problemCount: number; problemRatePercent: number }[];
  overweight: {
    bySeller: { sellerName: string; totalCount: number; overweightCount: number; overweightRatePercent: number }[];
    byPeriod: { period: string; totalCount: number; overweightCount: number; overweightRatePercent: number }[];
  };
}

export function fetchSellerStockQuality(token: string, params?: ReportDateRangeParams) {
  return apiRequest<SellerStockQualityReport>(`/reports/seller-stock-quality${dateRangeQueryString(params)}`, { token });
}

export interface ReceptionSourcesReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; byTransporter: { transporterCompany: string; quantity: number }[] }[];
  /** Top 8 transporter companies by total quantity across the whole selected range. */
  topTransporters: { transporterCompany: string; totalQuantity: number }[];
}

export function fetchReceptionSources(token: string, params?: ReportDateRangeParams) {
  return apiRequest<ReceptionSourcesReport>(`/reports/reception-sources${dateRangeQueryString(params)}`, { token });
}

export interface ReceptionReliabilityReport {
  granularity: ReportGranularity;
  byPeriod: { period: string; unfinishedCount: number; totalCount: number; unfinishedRatePercent: number }[];
  byStaff: { userId: string; userName: string; unfinishedCount: number; totalCount: number; unfinishedRatePercent: number }[];
}

export function fetchReceptionReliability(token: string, params?: ReportDateRangeParams) {
  return apiRequest<ReceptionReliabilityReport>(`/reports/reception-reliability${dateRangeQueryString(params)}`, { token });
}

/** Mirrors packages/backend/src/reports/reports.types.ts's StaffActivityEntry — only one of the type-specific fields is ever populated, per `type`. */
export type StaffActivityType =
  | 'floor_task'
  | 'reception'
  | 'open_pool'
  | 'directive'
  | 'lunch_break'
  | 'short_break'
  | 'idle';

export interface StaffActivityEntry {
  type: StaffActivityType;
  id: string;
  userId: string;
  userName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  floorTaskCategory?: string;
  scannedBarcode?: string | null;
  /** type === 'floor_task', scope 'recent' only — undefined for 'live' (a floor task is never ended there). */
  floorTaskOutcome?: 'completed' | 'cancelled';
  receptionOutcome?: 'completed' | 'unfinished' | null;
  openPoolTitle?: string;
  openPoolDescription?: string | null;
  directiveType?: string;
  directiveMessage?: string;
  /** type === 'lunch_break' | 'short_break' only — ms remaining (lunch has no real cap, can go negative). */
  breakRemainingMs?: number | null;
  /** This person's total clocked shift time today (net of lunch break) — same figure on every one of their rows. */
  hoursWorkedToday: number;
}

export interface StaffActivityReport {
  entries: StaffActivityEntry[];
}

export function fetchStaffActivity(token: string, scope: 'live' | 'recent') {
  return apiRequest<StaffActivityReport>(`/reports/staff-activity?scope=${scope}`, { token });
}

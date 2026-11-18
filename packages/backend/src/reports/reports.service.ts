import { Injectable } from '@nestjs/common';

import { FLOOR_TASK_CATEGORIES } from '../floor-tasks/floor-task.types';
import { PrismaService } from '../prisma/prisma.service';
import { type ReceptionCategory } from '../receptions/reception.types';
import { type Weekday } from '../schedules/schedule.types';
import { type PalletConditionFlag } from '../seller-stock/seller-stock.types';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import { LUNCH_BREAK_SUGGESTED_DURATION_MS, SHORT_BREAK_LIMIT_MS } from '../shifts/shift.types';
import { type ReportDateRangeQuery } from './dto/report-date-range.dto';
import {
  type AdminDashboardReport,
  type AttendanceReport,
  type BreakKind,
  type IdleKind,
  type OpenPoolBucketKind,
  type OrderPrepReport,
  type OrderPrepRoleStats,
  type OverviewReport,
  type PutAwayReport,
  type ReceptionDurationReport,
  type ReceptionReliabilityReport,
  type ReceptionReport,
  type ReceptionSourcesReport,
  type ReceptionVolumeReport,
  type ReportGranularity,
  type SellerStockQualityReport,
  type StaffActivityBreakdown,
  type StaffActivityEntry,
  type StaffActivityReport,
  type StaffActivityScope,
  type StaffHistoryExportReport,
  type StaffHistoryExportRow,
  type StaffHistoryV2Report,
  type StaffStatus,
  type StaffSummaryReport,
} from './reports.types';

/** Admin never needs an unbounded scrollback of every finished task ever — see staffActivity()'s 'recent' scope. */
const STAFF_ACTIVITY_RECENT_LIMIT = 50;

/** "YYYY-MM-DD", UTC — see schema.prisma's StaffSchedule doc comment for the same UTC-as-local simplification used throughout. */
function dateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive of both ends. */
function enumerateDaysUTC(startKey: string, endKey: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(dateKeyUTC(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const WEEKDAY_BY_UTC_DAY_INDEX: Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const RECEPTION_CATEGORIES: ReceptionCategory[] = [
  'return_parcels',
  'packaging_stock',
  'sellers_stock',
  'equipment_other',
];

const DEFAULT_GRANULARITY: ReportGranularity = 'day';
const TOP_TRANSPORTERS_LIMIT = 8;

/** ISO 8601 week key ("YYYY-Www") — the Thursday of the week decides which ISO year it belongs to. */
function isoWeekKeyUTC(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Buckets a timestamp into the period key matching the requested granularity — shared by every Reception Report below rather than repeating this per-endpoint. */
function periodKeyUTC(date: Date, granularity: ReportGranularity): string {
  switch (granularity) {
    case 'day':
      return dateKeyUTC(date);
    case 'week':
      return isoWeekKeyUTC(date);
    case 'month':
      return date.toISOString().slice(0, 7); // YYYY-MM
    case 'quarter':
      return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  }
}

/** Turns the shared `{ granularity, from, to }` query into a Prisma date filter plus the resolved granularity (defaulting to "day"). Omits the filter entirely when both bounds are absent — "cover all data" per every endpoint's doc comment. */
function resolveDateRange(query: ReportDateRangeQuery): {
  granularity: ReportGranularity;
  dateFilter: { gte?: Date; lte?: Date } | undefined;
} {
  const granularity = query.granularity ?? DEFAULT_GRANULARITY;
  if (!query.from && !query.to) return { granularity, dateFilter: undefined };
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (query.from) dateFilter.gte = new Date(`${query.from}T00:00:00.000Z`);
  if (query.to) dateFilter.lte = new Date(`${query.to}T23:59:59.999Z`);
  return { granularity, dateFilter };
}

/** Sums completed *lunch* breaks (endedAt set) per shiftId — worked-hours totals subtract this, since lunch is unpaid, not time on task. Short breaks are paid and deliberately excluded here. */
function sumBreakMsByShift(
  breaks: { shiftId: string; type: 'lunch' | 'short'; startedAt: Date; endedAt: Date | null }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of breaks) {
    if (b.type !== 'lunch' || !b.endedAt) continue;
    const ms = b.endedAt.getTime() - b.startedAt.getTime();
    map.set(b.shiftId, (map.get(b.shiftId) ?? 0) + ms);
  }
  return map;
}

/** Cumulative "short" break time per shiftId, including any currently in progress (counted up to `now`) — mirrors ShiftsService's own private method, kept local here rather than shared across modules for the same reason sumBreakMsByShift above is. */
function sumShortBreakMsByShift(breaks: { shiftId: string; type: 'lunch' | 'short'; startedAt: Date; endedAt: Date | null }[], now: Date): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of breaks) {
    if (b.type !== 'short') continue;
    const ms = (b.endedAt ?? now).getTime() - b.startedAt.getTime();
    map.set(b.shiftId, (map.get(b.shiftId) ?? 0) + ms);
  }
  return map;
}

const BREAK_KINDS: BreakKind[] = ['lunch', 'short'];
const IDLE_KINDS: IdleKind[] = ['unclaimed', 'off_shift'];
const OPEN_POOL_KINDS: OpenPoolBucketKind[] = ['directive', 'general'];

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function zeroBreakdown(): StaffActivityBreakdown {
  return {
    plannedMs: null,
    onlineMs: 0,
    claimedMs: 0,
    receptionMs: zeroRecord(RECEPTION_CATEGORIES),
    floorTaskMs: zeroRecord(FLOOR_TASK_CATEGORIES),
    openPoolMs: zeroRecord(OPEN_POOL_KINDS),
    breakMs: zeroRecord(BREAK_KINDS),
    idleMs: zeroRecord(IDLE_KINDS),
  };
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

/** Field-wise accumulation of `source` into `target` — used to build a Cumulative total across many days. `plannedMs` null (no schedule that day) contributes 0 rather than poisoning the whole sum to null. */
function addBreakdown(target: StaffActivityBreakdown, source: StaffActivityBreakdown): void {
  target.plannedMs = (target.plannedMs ?? 0) + (source.plannedMs ?? 0);
  target.onlineMs += source.onlineMs;
  target.claimedMs += source.claimedMs;
  for (const k of RECEPTION_CATEGORIES) target.receptionMs[k] += source.receptionMs[k];
  for (const k of FLOOR_TASK_CATEGORIES) target.floorTaskMs[k] += source.floorTaskMs[k];
  for (const k of OPEN_POOL_KINDS) target.openPoolMs[k] += source.openPoolMs[k];
  for (const k of BREAK_KINDS) target.breakMs[k] += source.breakMs[k];
  for (const k of IDLE_KINDS) target.idleMs[k] += source.idleMs[k];
}

/** "HH:MM" -> ms since midnight. */
function parseHHMMToMsOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) * 60_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length / 60_000) * 10) / 10; // ms -> minutes, 1 decimal place
}

/** Percentage, 1 decimal place. 0 (not null) when the denominator is 0 — "0 out of 0" reads as "nothing to report," not "unknown," everywhere this is used. */
function percent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

const periodAscending = (a: { period: string }, b: { period: string }) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0);

/**
 * Read-only aggregation over data other services already record — no
 * new tables, no writes. See reports.types.ts for why each report
 * looks the way it does relative to the requirements doc.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
  ) {}

  async overview(): Promise<OverviewReport> {
    const [staffOnShiftCount, totalStaffCount, palletsPendingReviewCount, openPutAwayTaskCount, activeSessionRows] =
      await Promise.all([
        this.prisma.shift.count({ where: { endedAt: null } }),
        this.prisma.user.count({ where: { role: 'staff' } }),
        this.prisma.sellerStockPallet.count({ where: { status: 'pending_admin_review' } }),
        this.prisma.putAwayTask.count({ where: { status: { in: ['assigned', 'in_progress', 'issue_reported'] } } }),
        this.prisma.orderPrepTask.findMany({
          where: { status: { in: ['assigned', 'in_progress'] } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        }),
      ]);

    return {
      staffOnShiftCount,
      totalStaffCount,
      palletsPendingReviewCount,
      openPutAwayTaskCount,
      activeOrderPrepSessionCount: activeSessionRows.length,
      generatedAt: new Date().toISOString(),
    };
  }

  async attendance(): Promise<AttendanceReport> {
    const [completedShifts, users] = await Promise.all([
      this.prisma.shift.findMany({ where: { endedAt: { not: null } } }),
      this.prisma.user.findMany(),
    ]);
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    const breaks = await this.prisma.break.findMany({
      where: { shiftId: { in: completedShifts.map((s) => s.id) } },
    });
    const breakMsByShift = sumBreakMsByShift(breaks);

    const totals = new Map<string, { totalShifts: number; totalMs: number }>();
    for (const shift of completedShifts) {
      const durationMs = shift.endedAt!.getTime() - shift.startedAt.getTime() - (breakMsByShift.get(shift.id) ?? 0);
      const existing = totals.get(shift.userId) ?? { totalShifts: 0, totalMs: 0 };
      existing.totalShifts += 1;
      existing.totalMs += durationMs;
      totals.set(shift.userId, existing);
    }

    const rows = [...totals.entries()]
      .map(([userId, { totalShifts, totalMs }]) => ({
        userId,
        userName: userNames.get(userId) ?? 'Unknown',
        totalShifts,
        totalHoursWorked: Math.round((totalMs / 3_600_000) * 10) / 10,
      }))
      .sort((a, b) => b.totalHoursWorked - a.totalHoursWorked);

    return { rows };
  }

  /**
   * Core engine behind the "Staff" (table 2, today only) and "Staff
   * History" (table 3, many days + a Cumulative) web dashboard tables —
   * see StaffActivityBreakdown's doc comment in reports.types.ts for
   * what each field means and how they relate to one another. One pass
   * over the underlying records (Shift/Break/FloorTaskLog/ReceptionTask/
   * OpenPoolTask/Directive), bucketed per user per day by each record's
   * own start timestamp; callers slice the result differently —
   * staffSummary() just reads today, staffHistoryV2() reads every day
   * since the app's first shift and also sums a Cumulative,
   * staffHistoryExport() reads a per-user day range starting at that
   * user's own account creation date.
   *
   * A record still in progress (no end timestamp yet) only has its
   * elapsed-so-far time counted when its *start* day is today — a
   * record that somehow started on a past day and is still open counts
   * zero additional time for that past day beyond its last known
   * heartbeat/pause state, rather than ballooning into a many-day
   * duration (an accepted simplification for an edge case the app's
   * own stale-shift auto-end logic is expected to clean up promptly —
   * see Shift.lastHeartbeatAt's doc comment).
   */
  private async computeActivityBreakdowns(
    userIds: string[],
    dayKeys: string[],
  ): Promise<Map<string, Map<string, StaffActivityBreakdown>>> {
    const result = new Map<string, Map<string, StaffActivityBreakdown>>();
    for (const userId of userIds) {
      const byDay = new Map<string, StaffActivityBreakdown>();
      for (const day of dayKeys) byDay.set(day, zeroBreakdown());
      result.set(userId, byDay);
    }
    if (userIds.length === 0 || dayKeys.length === 0) return result;

    const now = new Date();
    const todayKey = dateKeyUTC(now);
    const rangeStart = new Date(`${dayKeys[0]}T00:00:00.000Z`);
    const rangeEndExclusive = new Date(`${dayKeys[dayKeys.length - 1]}T00:00:00.000Z`);
    rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);
    const inDayRange = { gte: rangeStart, lt: rangeEndExclusive };

    const [schedules, shifts, floorTasks, receptionTasks, openPoolTasks, directives] = await Promise.all([
      this.prisma.staffSchedule.findMany({ where: { userId: { in: userIds } } }),
      this.prisma.shift.findMany({ where: { userId: { in: userIds }, startedAt: inDayRange } }),
      this.prisma.floorTaskLog.findMany({ where: { userId: { in: userIds }, startedAt: inDayRange, cancelledAt: null } }),
      this.prisma.receptionTask.findMany({ where: { userId: { in: userIds }, startedAt: inDayRange } }),
      this.prisma.openPoolTask.findMany({ where: { claimedByUserId: { in: userIds }, claimedAt: inDayRange } }),
      this.prisma.directive.findMany({ where: { receivedByUserId: { in: userIds }, receivedAt: inDayRange } }),
    ]);
    const breaks = shifts.length
      ? await this.prisma.break.findMany({ where: { shiftId: { in: shifts.map((s) => s.id) } } })
      : [];
    const receptionIds = receptionTasks.map((t) => t.receptionId).filter((id): id is string => id !== null);
    const receptionsForTasks: { id: string; category: ReceptionCategory }[] = receptionIds.length
      ? await this.prisma.reception.findMany({ where: { id: { in: receptionIds } }, select: { id: true, category: true } })
      : [];

    const scheduleByUser = new Map(schedules.map((s) => [s.userId, s]));
    const receptionCategoryById = new Map<string, ReceptionCategory>(receptionsForTasks.map((r) => [r.id, r.category]));
    const breaksByShiftId = new Map<string, typeof breaks>();
    for (const b of breaks) {
      const list = breaksByShiftId.get(b.shiftId) ?? [];
      list.push(b);
      breaksByShiftId.set(b.shiftId, list);
    }

    const get = (userId: string, day: string) => result.get(userId)?.get(day);
    const effectiveEnd = (endedAt: Date | null, startDay: string, fallback: Date) =>
      endedAt ?? (startDay === todayKey ? now : fallback);

    // Planned — independent of every other source below.
    for (const userId of userIds) {
      const schedule = scheduleByUser.get(userId);
      if (!schedule) continue;
      for (const day of dayKeys) {
        const breakdown = get(userId, day);
        if (!breakdown) continue;
        const weekday = WEEKDAY_BY_UTC_DAY_INDEX[new Date(`${day}T00:00:00.000Z`).getUTCDay()];
        if (!schedule.workingDays.includes(weekday)) continue;
        if (day === todayKey) {
          const plannedStartMs = new Date(`${day}T00:00:00.000Z`).getTime() + parseHHMMToMsOfDay(schedule.shiftStartTime);
          breakdown.plannedMs = Math.max(0, now.getTime() - plannedStartMs);
        } else {
          // A past day's "planned" is its scheduled shift length — "now minus that day's start time" would just be a stale multi-day figure, not a useful one.
          breakdown.plannedMs = schedule.requiredWorkingHours * 3_600_000;
        }
      }
    }

    // Shifts -> Online, their Breaks -> the Break column, and (per user/day) Off-Shift gaps between consecutive shifts.
    const shiftsByUserDay = new Map<string, Map<string, { startedAt: Date; endedAt: Date | null }[]>>();
    for (const shift of shifts) {
      const day = dateKeyUTC(shift.startedAt);
      const breakdown = get(shift.userId, day);
      if (breakdown) {
        const end = effectiveEnd(shift.endedAt, day, shift.lastHeartbeatAt ?? shift.startedAt);
        breakdown.onlineMs += Math.max(0, end.getTime() - shift.startedAt.getTime());
      }
      const userDays = shiftsByUserDay.get(shift.userId) ?? new Map<string, { startedAt: Date; endedAt: Date | null }[]>();
      const dayShifts = userDays.get(day) ?? [];
      dayShifts.push({ startedAt: shift.startedAt, endedAt: shift.endedAt });
      userDays.set(day, dayShifts);
      shiftsByUserDay.set(shift.userId, userDays);

      for (const b of breaksByShiftId.get(shift.id) ?? []) {
        const breakDay = dateKeyUTC(b.startedAt);
        const breakBreakdown = get(shift.userId, breakDay);
        if (!breakBreakdown) continue;
        const bEnd = effectiveEnd(b.endedAt, breakDay, b.startedAt);
        breakBreakdown.breakMs[b.type] += Math.max(0, bEnd.getTime() - b.startedAt.getTime());
      }
    }
    for (const [userId, userDays] of shiftsByUserDay) {
      for (const [day, dayShifts] of userDays) {
        const breakdown = get(userId, day);
        if (!breakdown) continue;
        const sorted = [...dayShifts].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
        for (let i = 1; i < sorted.length; i++) {
          const prevEnd = sorted[i - 1].endedAt;
          if (!prevEnd) continue; // an unended previous shift means there's no real gap to measure (and no later shift should exist same day anyway)
          const gapMs = sorted[i].startedAt.getTime() - prevEnd.getTime();
          if (gapMs > 0) breakdown.idleMs.off_shift += gapMs;
        }
      }
    }

    for (const t of floorTasks) {
      const day = dateKeyUTC(t.startedAt);
      const breakdown = get(t.userId, day);
      if (!breakdown) continue;
      const end = effectiveEnd(t.endedAt, day, t.startedAt);
      const openPauseMs = t.pausedAt ? Math.max(0, end.getTime() - t.pausedAt.getTime()) : 0;
      breakdown.floorTaskMs[t.category] += Math.max(0, end.getTime() - t.startedAt.getTime() - t.totalPausedMs - openPauseMs);
    }

    for (const t of receptionTasks) {
      const category = t.receptionId ? receptionCategoryById.get(t.receptionId) : undefined;
      if (!category) continue; // no linked Reception to categorize by — excluded the same way an unattributable row is excluded elsewhere in this module
      const day = dateKeyUTC(t.startedAt);
      const breakdown = get(t.userId, day);
      if (!breakdown) continue;
      const end = effectiveEnd(t.endedAt, day, t.startedAt);
      const openPauseMs = t.pausedAt ? Math.max(0, end.getTime() - t.pausedAt.getTime()) : 0;
      breakdown.receptionMs[category] += Math.max(0, end.getTime() - t.startedAt.getTime() - t.totalPausedMs - openPauseMs);
    }

    for (const t of openPoolTasks) {
      if (!t.claimedByUserId || !t.claimedAt) continue;
      const day = dateKeyUTC(t.claimedAt);
      const breakdown = get(t.claimedByUserId, day);
      if (!breakdown) continue;
      const end = effectiveEnd(t.completedAt, day, t.claimedAt);
      breakdown.openPoolMs.general += Math.max(0, end.getTime() - t.claimedAt.getTime());
    }

    for (const d of directives) {
      if (!d.receivedByUserId || !d.receivedAt) continue;
      const day = dateKeyUTC(d.receivedAt);
      const breakdown = get(d.receivedByUserId, day);
      if (!breakdown) continue;
      const end = effectiveEnd(d.resolvedAt, day, d.receivedAt);
      breakdown.openPoolMs.directive += Math.max(0, end.getTime() - d.receivedAt.getTime());
    }

    // Claimed + Idle(unclaimed) depend on every other field above, so computed last.
    for (const userId of userIds) {
      for (const day of dayKeys) {
        const breakdown = get(userId, day);
        if (!breakdown) continue;
        breakdown.claimedMs =
          sumRecord(breakdown.receptionMs) + sumRecord(breakdown.floorTaskMs) + sumRecord(breakdown.openPoolMs) + sumRecord(breakdown.breakMs);
        breakdown.idleMs.unclaimed = Math.max(0, breakdown.onlineMs - breakdown.claimedMs);
      }
    }

    return result;
  }

  /** Backs the web dashboard's "Staff" table (table 2) — today only. */
  async staffSummary(): Promise<StaffSummaryReport> {
    const staffUsers = await this.prisma.user.findMany({ where: { role: 'staff' } });
    const todayKey = dateKeyUTC(new Date());
    const breakdowns = await this.computeActivityBreakdowns(
      staffUsers.map((u) => u.id),
      [todayKey],
    );
    return {
      staff: staffUsers.map((u) => ({
        userId: u.id,
        userName: u.name,
        breakdown: breakdowns.get(u.id)?.get(todayKey) ?? zeroBreakdown(),
      })),
    };
  }

  /**
   * Backs the web dashboard's "Staff History" table (table 3) — the
   * on-screen, day-grouped pivot, one column-group per day since the
   * app's very first shift (completed or still running) plus a
   * Cumulative group. Same breakdown shape as staffSummary(), just one
   * per day instead of one for today only.
   */
  async staffHistoryV2(): Promise<StaffHistoryV2Report> {
    const [staffUsers, allShifts] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'staff' } }),
      this.prisma.shift.findMany({ select: { startedAt: true } }),
    ]);

    if (allShifts.length === 0) {
      return { days: [], staff: staffUsers.map((u) => ({ userId: u.id, userName: u.name, days: {}, cumulative: zeroBreakdown() })) };
    }

    const earliestMs = Math.min(...allShifts.map((s) => s.startedAt.getTime()));
    const days = enumerateDaysUTC(dateKeyUTC(new Date(earliestMs)), dateKeyUTC(new Date()));
    const breakdowns = await this.computeActivityBreakdowns(
      staffUsers.map((u) => u.id),
      days,
    );

    const staff = staffUsers.map((user) => {
      const userDays = breakdowns.get(user.id) ?? new Map<string, StaffActivityBreakdown>();
      const dayEntries: Record<string, StaffActivityBreakdown> = {};
      const cumulative = zeroBreakdown();
      for (const day of days) {
        const entry = userDays.get(day) ?? zeroBreakdown();
        dayEntries[day] = entry;
        addBreakdown(cumulative, entry);
      }
      return { userId: user.id, userName: user.name, days: dayEntries, cumulative };
    });

    return { days, staff };
  }

  /**
   * Backs the Staff History Excel export's long format — one row per
   * staff member per calendar day from that staff's own account
   * creation date through today, including zero-activity days. For a
   * staff member who already existed when the `User.createdAt` column
   * was added (backfilled to the migration's run time, not their true
   * original creation date — see schema.prisma's doc comment on that
   * column), this still reaches back to cover their real history: the
   * day range starts at whichever is earlier, their `createdAt` or the
   * earliest day any activity of theirs was found, so no existing
   * history is silently dropped.
   */
  async staffHistoryExport(): Promise<StaffHistoryExportReport> {
    const [staffUsers, allShifts] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'staff' } }),
      this.prisma.shift.findMany({ select: { startedAt: true } }),
    ]);

    const todayKey = dateKeyUTC(new Date());
    const earliestShiftMs = allShifts.length ? Math.min(...allShifts.map((s) => s.startedAt.getTime())) : null;
    const earliestUserCreatedMs = staffUsers.length ? Math.min(...staffUsers.map((u) => u.createdAt.getTime())) : Date.now();
    const globalStartMs = Math.min(earliestShiftMs ?? earliestUserCreatedMs, earliestUserCreatedMs);
    const days = enumerateDaysUTC(dateKeyUTC(new Date(globalStartMs)), todayKey);

    const breakdowns = await this.computeActivityBreakdowns(
      staffUsers.map((u) => u.id),
      days,
    );

    const isNonZero = (b: StaffActivityBreakdown) => b.onlineMs > 0 || sumRecord(b.idleMs) > 0 || (b.plannedMs ?? 0) > 0;

    const rows: StaffHistoryExportRow[] = [];
    for (const user of staffUsers) {
      const userDays = breakdowns.get(user.id) ?? new Map<string, StaffActivityBreakdown>();
      const createdDay = dateKeyUTC(user.createdAt);
      let earliestNonZeroDay: string | null = null;
      for (const day of days) {
        if (isNonZero(userDays.get(day) ?? zeroBreakdown())) {
          earliestNonZeroDay = day;
          break;
        }
      }
      const startDay = earliestNonZeroDay && earliestNonZeroDay < createdDay ? earliestNonZeroDay : createdDay;
      for (const day of days) {
        if (day < startDay) continue;
        rows.push({ userId: user.id, userName: user.name, date: day, breakdown: userDays.get(day) ?? zeroBreakdown() });
      }
    }
    return { rows };
  }

  /**
   * Each staff member's total clocked shift time today (net of lunch
   * break) — the same figure adminDashboard() computes per-user inline
   * for StaffStatus.hoursWorkedToday, pulled out so staffActivity() can
   * reuse it without duplicating adminDashboard()'s larger method.
   * Deliberately only sums *ended* shifts (an in-progress shift's
   * duration isn't known yet), same rule as everywhere else this figure
   * appears.
   */
  private async hoursWorkedTodayByUser(): Promise<Map<string, number>> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const shiftsToday = await this.prisma.shift.findMany({ where: { startedAt: { gte: startOfDay } } });
    const breaksToday = await this.prisma.break.findMany({ where: { shiftId: { in: shiftsToday.map((s) => s.id) } } });
    const breakMsByShift = sumBreakMsByShift(breaksToday);

    const totalMsByUser = new Map<string, number>();
    for (const shift of shiftsToday) {
      if (!shift.endedAt) continue;
      const ms = shift.endedAt.getTime() - shift.startedAt.getTime() - (breakMsByShift.get(shift.id) ?? 0);
      totalMsByUser.set(shift.userId, (totalMsByUser.get(shift.userId) ?? 0) + ms);
    }

    const hoursByUser = new Map<string, number>();
    for (const [userId, ms] of totalMsByUser) hoursByUser.set(userId, Math.round((ms / 3_600_000) * 10) / 10);
    return hoursByUser;
  }

  /**
   * Backs the web dashboard's "Staff Activity" section — see
   * StaffActivityEntry's doc comment for why this merges 4 task sources
   * plus (live scope only) a Break/Idle row for every other on-shift
   * staff member. `scope: 'live'` reads each source's in-progress rows;
   * `'recent'` reads their most recently *finished* rows instead
   * (capped at STAFF_ACTIVITY_RECENT_LIMIT, newest-first) — the only
   * place a completed Dispatch Floor Task's scannedBarcode is visible
   * to Admin.
   */
  async staffActivity(scope: StaffActivityScope): Promise<StaffActivityReport> {
    const isLive = scope === 'live';

    const [floorTasks, receptionTasks, openPoolTasks, directives] = await Promise.all([
      isLive
        ? this.prisma.floorTaskLog.findMany({ where: { endedAt: null }, orderBy: { startedAt: 'asc' } })
        : this.prisma.floorTaskLog.findMany({
            where: { endedAt: { not: null } },
            orderBy: { endedAt: 'desc' },
            take: STAFF_ACTIVITY_RECENT_LIMIT,
          }),
      isLive
        ? this.prisma.receptionTask.findMany({ where: { endedAt: null }, orderBy: { startedAt: 'asc' } })
        : this.prisma.receptionTask.findMany({
            where: { endedAt: { not: null } },
            orderBy: { endedAt: 'desc' },
            take: STAFF_ACTIVITY_RECENT_LIMIT,
          }),
      isLive
        ? this.prisma.openPoolTask.findMany({ where: { status: 'claimed' }, orderBy: { claimedAt: 'asc' } })
        : this.prisma.openPoolTask.findMany({
            where: { status: 'completed' },
            orderBy: { completedAt: 'desc' },
            take: STAFF_ACTIVITY_RECENT_LIMIT,
          }),
      isLive
        ? this.prisma.directive.findMany({ where: { status: 'in_progress' }, orderBy: { receivedAt: 'asc' } })
        : this.prisma.directive.findMany({
            where: { status: 'resolved' },
            orderBy: { resolvedAt: 'desc' },
            take: STAFF_ACTIVITY_RECENT_LIMIT,
          }),
    ]);

    const userIds = new Set<string>();
    for (const t of floorTasks) userIds.add(t.userId);
    for (const t of receptionTasks) userIds.add(t.userId);
    for (const t of openPoolTasks) if (t.claimedByUserId) userIds.add(t.claimedByUserId);
    for (const d of directives) if (d.receivedByUserId) userIds.add(d.receivedByUserId);

    // Live only: every other on-shift staff member not already covered by one of the 4 task sources above gets a Break or Idle row — see the block appending `extraEntries` below.
    const uncoveredShifts = isLive
      ? await this.prisma.shift.findMany({ where: { endedAt: null, userId: { notIn: [...userIds] } } })
      : [];
    for (const shift of uncoveredShifts) userIds.add(shift.userId);

    const [users, hoursWorkedTodayByUser] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: [...userIds] } } }),
      this.hoursWorkedTodayByUser(),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const nameFor = (userId: string) => nameById.get(userId) ?? 'Unknown';
    const hoursWorkedTodayFor = (userId: string) => hoursWorkedTodayByUser.get(userId) ?? 0;

    const entries: StaffActivityEntry[] = [
      ...floorTasks.map((t): StaffActivityEntry => {
        const openPauseMs = isLive && t.pausedAt ? Date.now() - t.pausedAt.getTime() : 0;
        return {
          type: 'floor_task',
          id: t.id,
          userId: t.userId,
          userName: nameFor(t.userId),
          startedAt: t.startedAt.toISOString(),
          endedAt: t.endedAt ? t.endedAt.toISOString() : null,
          durationMs: t.endedAt ? t.endedAt.getTime() - t.startedAt.getTime() - t.totalPausedMs : null,
          floorTaskCategory: t.category,
          scannedBarcode: t.category === 'dispatch' ? t.scannedBarcode : undefined,
          floorTaskOutcome: isLive ? undefined : t.cancelledAt ? 'cancelled' : 'completed',
          hoursWorkedToday: hoursWorkedTodayFor(t.userId),
        };
      }),
      ...receptionTasks.map(
        (t): StaffActivityEntry => ({
          type: 'reception',
          id: t.id,
          userId: t.userId,
          userName: nameFor(t.userId),
          startedAt: t.startedAt.toISOString(),
          endedAt: t.endedAt ? t.endedAt.toISOString() : null,
          durationMs: t.endedAt ? t.endedAt.getTime() - t.startedAt.getTime() - t.totalPausedMs : null,
          receptionOutcome: t.outcome,
          hoursWorkedToday: hoursWorkedTodayFor(t.userId),
        }),
      ),
      ...openPoolTasks.map(
        (t): StaffActivityEntry => ({
          type: 'open_pool',
          id: t.id,
          userId: t.claimedByUserId!,
          userName: nameFor(t.claimedByUserId!),
          startedAt: (t.claimedAt ?? t.createdAt).toISOString(),
          endedAt: t.completedAt ? t.completedAt.toISOString() : null,
          durationMs: t.completedAt && t.claimedAt ? t.completedAt.getTime() - t.claimedAt.getTime() : null,
          openPoolTitle: t.title,
          openPoolDescription: t.description,
          hoursWorkedToday: hoursWorkedTodayFor(t.claimedByUserId!),
        }),
      ),
      ...directives.map(
        (d): StaffActivityEntry => ({
          type: 'directive',
          id: d.id,
          userId: d.receivedByUserId!,
          userName: nameFor(d.receivedByUserId!),
          startedAt: (d.receivedAt ?? d.pushedAt).toISOString(),
          endedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
          durationMs: d.resolvedAt && d.receivedAt ? d.resolvedAt.getTime() - d.receivedAt.getTime() : null,
          directiveType: d.type,
          directiveMessage: d.message,
          hoursWorkedToday: hoursWorkedTodayFor(d.receivedByUserId!),
        }),
      ),
    ];

    if (isLive && uncoveredShifts.length > 0) {
      const allBreaksForUncoveredShifts = await this.prisma.break.findMany({
        where: { shiftId: { in: uncoveredShifts.map((s) => s.id) } },
      });
      const shortBreakMsByShift = sumShortBreakMsByShift(allBreaksForUncoveredShifts, new Date());
      const activeBreakByShiftId = new Map(allBreaksForUncoveredShifts.filter((b) => !b.endedAt).map((b) => [b.shiftId, b]));

      // "Since when" for an Idle row (not on a task or break) — the later of this shift's start or the most recent thing (of any kind) this person finished, each capped to a handful of rows per source so this stays cheap even with a long task history.
      const idleShifts = uncoveredShifts.filter((s) => !activeBreakByShiftId.has(s.id));
      const idleUserIds = idleShifts.map((s) => s.userId);
      const idleSinceByUser = new Map<string, Date>();
      if (idleUserIds.length > 0) {
        const recentLimit = Math.max(20, idleUserIds.length * 5);
        const [lastFloor, lastReception, lastOpenPool, lastDirective, lastBreak] = await Promise.all([
          this.prisma.floorTaskLog.findMany({ where: { userId: { in: idleUserIds }, endedAt: { not: null } }, orderBy: { endedAt: 'desc' }, take: recentLimit }),
          this.prisma.receptionTask.findMany({ where: { userId: { in: idleUserIds }, endedAt: { not: null } }, orderBy: { endedAt: 'desc' }, take: recentLimit }),
          this.prisma.openPoolTask.findMany({ where: { claimedByUserId: { in: idleUserIds }, completedAt: { not: null } }, orderBy: { completedAt: 'desc' }, take: recentLimit }),
          this.prisma.directive.findMany({ where: { receivedByUserId: { in: idleUserIds }, resolvedAt: { not: null } }, orderBy: { resolvedAt: 'desc' }, take: recentLimit }),
          this.prisma.break.findMany({ where: { shiftId: { in: idleShifts.map((s) => s.id) }, endedAt: { not: null } }, orderBy: { endedAt: 'desc' }, take: recentLimit }),
        ]);
        const considerCandidate = (userId: string, at: Date) => {
          const current = idleSinceByUser.get(userId);
          if (!current || at.getTime() > current.getTime()) idleSinceByUser.set(userId, at);
        };
        const shiftById = new Map(idleShifts.map((s) => [s.id, s]));
        for (const t of lastFloor) if (t.endedAt) considerCandidate(t.userId, t.endedAt);
        for (const t of lastReception) if (t.endedAt) considerCandidate(t.userId, t.endedAt);
        for (const t of lastOpenPool) if (t.completedAt && t.claimedByUserId) considerCandidate(t.claimedByUserId, t.completedAt);
        for (const d of lastDirective) if (d.resolvedAt && d.receivedByUserId) considerCandidate(d.receivedByUserId, d.resolvedAt);
        for (const b of lastBreak) {
          const shift = shiftById.get(b.shiftId);
          if (b.endedAt && shift) considerCandidate(shift.userId, b.endedAt);
        }
        // Never let a candidate predate this shift's own start — a previous shift's finished task shouldn't anchor idle time before the current shift began.
        for (const shift of idleShifts) {
          const candidate = idleSinceByUser.get(shift.userId);
          if (!candidate || candidate.getTime() < shift.startedAt.getTime()) idleSinceByUser.set(shift.userId, shift.startedAt);
        }
      }

      for (const shift of uncoveredShifts) {
        const activeBreak = activeBreakByShiftId.get(shift.id);
        if (activeBreak) {
          const isShort = activeBreak.type === 'short';
          const breakRemainingMs = isShort
            ? Math.max(0, SHORT_BREAK_LIMIT_MS - (shortBreakMsByShift.get(shift.id) ?? 0))
            : LUNCH_BREAK_SUGGESTED_DURATION_MS - (Date.now() - activeBreak.startedAt.getTime());
          entries.push({
            type: isShort ? 'short_break' : 'lunch_break',
            id: activeBreak.id,
            userId: shift.userId,
            userName: nameFor(shift.userId),
            startedAt: activeBreak.startedAt.toISOString(),
            endedAt: null,
            durationMs: null,
            breakRemainingMs,
            hoursWorkedToday: hoursWorkedTodayFor(shift.userId),
          });
        } else {
          const since = idleSinceByUser.get(shift.userId) ?? shift.startedAt;
          entries.push({
            type: 'idle',
            id: `idle-${shift.id}`,
            userId: shift.userId,
            userName: nameFor(shift.userId),
            startedAt: since.toISOString(),
            endedAt: null,
            durationMs: null,
            hoursWorkedToday: hoursWorkedTodayFor(shift.userId),
          });
        }
      }
    }

    // Live: oldest-started first (who's been at it longest). Recent: newest-finished first.
    entries.sort((a, b) => {
      const aTime = new Date(isLive ? a.startedAt : (a.endedAt ?? a.startedAt)).getTime();
      const bTime = new Date(isLive ? b.startedAt : (b.endedAt ?? b.startedAt)).getTime();
      return isLive ? aTime - bTime : bTime - aTime;
    });
    if (!isLive) entries.splice(STAFF_ACTIVITY_RECENT_LIMIT);

    return { entries };
  }

  async reception(): Promise<ReceptionReport> {
    const receptions = await this.prisma.reception.findMany();

    const categories = RECEPTION_CATEGORIES.map((category) => {
      const inCategory = receptions.filter((r) => r.category === category);
      const completed = inCategory.filter((r) => r.processingDurationMs !== null);
      return {
        category,
        totalCount: inCategory.length,
        completedCount: completed.length,
        averageProcessingMinutes: average(completed.map((r) => r.processingDurationMs!)),
        flaggedCount: inCategory.filter((r) => r.flaggedForReview).length,
      };
    });

    return { categories };
  }

  /** Total deliveries per period (bucketed per the shared granularity/date-range query), split by category, plus the latest-vs-previous-period change and a day-of-week breakdown — backs the Reception Reports "Delivery Volume" section. */
  async receptionVolume(query: ReportDateRangeQuery): Promise<ReceptionVolumeReport> {
    const { granularity, dateFilter } = resolveDateRange(query);
    const receptions = await this.prisma.reception.findMany({
      where: dateFilter ? { arrivedAt: dateFilter } : undefined,
    });

    const byPeriodMap = new Map<string, Partial<Record<ReceptionCategory, number>>>();
    const weekdayTotals = new Map<Weekday, number>();
    for (const r of receptions) {
      const period = periodKeyUTC(r.arrivedAt, granularity);
      const byCategory = byPeriodMap.get(period) ?? {};
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      byPeriodMap.set(period, byCategory);

      const weekday = WEEKDAY_BY_UTC_DAY_INDEX[r.arrivedAt.getUTCDay()];
      weekdayTotals.set(weekday, (weekdayTotals.get(weekday) ?? 0) + 1);
    }

    const byPeriod = [...byPeriodMap.entries()]
      .map(([period, byCategory]) => ({
        period,
        total: Object.values(byCategory).reduce((sum: number, n) => sum + (n ?? 0), 0),
        byCategory,
      }))
      .sort(periodAscending);

    let percentChangeVsPreviousPeriod: number | null = null;
    if (byPeriod.length >= 2) {
      const previous = byPeriod[byPeriod.length - 2].total;
      const latest = byPeriod[byPeriod.length - 1].total;
      percentChangeVsPreviousPeriod = previous === 0 ? null : Math.round(((latest - previous) / previous) * 1000) / 10;
    }

    // A plain total per weekday across the whole range, NOT divided by the
    // number of weeks in range — a per-week average would need a rule for
    // partial weeks at the range's edges (e.g. a range starting on a
    // Wednesday has only one Monday in it), which skews the number in a way
    // that's hard to explain at a glance. A straight sum is honest about
    // what it is and still shows the relative weekday pattern.
    const WEEKDAY_ORDER: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const byWeekday = WEEKDAY_ORDER.map((weekday) => ({ weekday, total: weekdayTotals.get(weekday) ?? 0 }));

    return { granularity, byPeriod, percentChangeVsPreviousPeriod, byWeekday };
  }

  /** Average ReceptionTask worked time ('completed' outcomes only), by period/category/staff — backs the Reception Reports "Reception Duration" section. */
  async receptionDuration(query: ReportDateRangeQuery): Promise<ReceptionDurationReport> {
    const { granularity, dateFilter } = resolveDateRange(query);
    const tasks = await this.prisma.receptionTask.findMany({
      where: { outcome: 'completed', endedAt: { not: null }, ...(dateFilter ? { startedAt: dateFilter } : {}) },
    });

    const receptionIds = tasks.map((t) => t.receptionId).filter((id): id is string => id !== null);
    const receptions = receptionIds.length
      ? await this.prisma.reception.findMany({ where: { id: { in: receptionIds } } })
      : [];
    const categoryByReceptionId = new Map(receptions.map((r) => [r.id, r.category]));

    const userIds = [...new Set(tasks.map((t) => t.userId))];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
    const nameByUserId = new Map(users.map((u) => [u.id, u.name]));

    const byPeriodMs = new Map<string, number[]>();
    const byCategoryMs = new Map<ReceptionCategory, number[]>();
    const byStaffMs = new Map<string, number[]>();
    const pushMs = <K>(map: Map<K, number[]>, key: K, ms: number) => {
      const list = map.get(key);
      if (list) list.push(ms);
      else map.set(key, [ms]);
    };

    for (const t of tasks) {
      // Defensively fold in any still-open pause, same as FloorTaskLog's end() — don't assume the owning module never completes a task while paused.
      const openPauseMs = t.pausedAt ? t.endedAt!.getTime() - t.pausedAt.getTime() : 0;
      const ms = t.endedAt!.getTime() - t.startedAt.getTime() - t.totalPausedMs - openPauseMs;
      pushMs(byPeriodMs, periodKeyUTC(t.startedAt, granularity), ms);
      const category = t.receptionId ? categoryByReceptionId.get(t.receptionId) : undefined;
      if (category) pushMs(byCategoryMs, category, ms);
      pushMs(byStaffMs, t.userId, ms);
    }

    const byPeriod = [...byPeriodMs.entries()]
      .map(([period, msList]) => ({ period, averageMinutes: average(msList), completedCount: msList.length }))
      .sort(periodAscending);

    const byCategory = RECEPTION_CATEGORIES.map((category) => {
      const msList = byCategoryMs.get(category) ?? [];
      return { category, averageMinutes: average(msList), completedCount: msList.length };
    });

    const byStaff = [...byStaffMs.entries()].map(([userId, msList]) => ({
      userId,
      userName: nameByUserId.get(userId) ?? 'Unknown',
      averageMinutes: average(msList),
      completedCount: msList.length,
    }));

    return { granularity, byPeriod, byCategory, byStaff };
  }

  /** % of Seller Stock pallets with a condition problem (anything other than exactly `['good']`) and, separately, % overweight — by seller, problem type, and period. Backs the Reception Reports "Seller Stock Quality" section. */
  async sellerStockQuality(query: ReportDateRangeQuery): Promise<SellerStockQualityReport> {
    const { granularity, dateFilter } = resolveDateRange(query);
    const pallets = await this.prisma.sellerStockPallet.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
    });
    const isProblem = (flags: PalletConditionFlag[]) => !(flags.length === 1 && flags[0] === 'good');

    const bySellerTotal = new Map<string, number>();
    const bySellerProblem = new Map<string, number>();
    const bySellerOverweight = new Map<string, number>();
    const byProblemType = new Map<PalletConditionFlag, number>();
    const byPeriodTotal = new Map<string, number>();
    const byPeriodProblem = new Map<string, number>();
    const byPeriodOverweight = new Map<string, number>();
    const inc = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

    for (const p of pallets) {
      const period = periodKeyUTC(p.createdAt, granularity);
      inc(bySellerTotal, p.sellerName);
      inc(byPeriodTotal, period);
      if (isProblem(p.conditionFlags)) {
        inc(bySellerProblem, p.sellerName);
        inc(byPeriodProblem, period);
      }
      if (p.overweightFlag) {
        inc(bySellerOverweight, p.sellerName);
        inc(byPeriodOverweight, period);
      }
      for (const flag of p.conditionFlags) {
        byProblemType.set(flag, (byProblemType.get(flag) ?? 0) + 1);
      }
    }

    const bySeller = [...bySellerTotal.entries()].map(([sellerName, totalCount]) => {
      const problemCount = bySellerProblem.get(sellerName) ?? 0;
      return { sellerName, totalCount, problemCount, problemRatePercent: percent(problemCount, totalCount) };
    });
    const overweightBySeller = [...bySellerTotal.entries()].map(([sellerName, totalCount]) => {
      const overweightCount = bySellerOverweight.get(sellerName) ?? 0;
      return { sellerName, totalCount, overweightCount, overweightRatePercent: percent(overweightCount, totalCount) };
    });
    const byPeriod = [...byPeriodTotal.entries()]
      .map(([period, totalCount]) => {
        const problemCount = byPeriodProblem.get(period) ?? 0;
        return { period, totalCount, problemCount, problemRatePercent: percent(problemCount, totalCount) };
      })
      .sort(periodAscending);
    const overweightByPeriod = [...byPeriodTotal.entries()]
      .map(([period, totalCount]) => {
        const overweightCount = byPeriodOverweight.get(period) ?? 0;
        return { period, totalCount, overweightCount, overweightRatePercent: percent(overweightCount, totalCount) };
      })
      .sort(periodAscending);

    return {
      granularity,
      bySeller,
      byProblemType: [...byProblemType.entries()].map(([flag, count]) => ({ flag, count })),
      byPeriod,
      overweight: { bySeller: overweightBySeller, byPeriod: overweightByPeriod },
    };
  }

  /** Return Parcels quantity by transporter company, by period — top 8 companies, everything else folded into "Other". Backs the Reception Reports "Sources" section. */
  async receptionSources(query: ReportDateRangeQuery): Promise<ReceptionSourcesReport> {
    const { granularity, dateFilter } = resolveDateRange(query);
    const returns = await this.prisma.reception.findMany({
      where: { category: 'return_parcels', ...(dateFilter ? { arrivedAt: dateFilter } : {}) },
    });

    const totalByTransporter = new Map<string, number>();
    const byPeriodMap = new Map<string, Map<string, number>>();
    for (const r of returns) {
      const transporter = r.transporterCompany ?? 'Unknown';
      const qty = r.parcelCount ?? 0;
      totalByTransporter.set(transporter, (totalByTransporter.get(transporter) ?? 0) + qty);

      const period = periodKeyUTC(r.arrivedAt, granularity);
      const periodMap = byPeriodMap.get(period) ?? new Map<string, number>();
      periodMap.set(transporter, (periodMap.get(transporter) ?? 0) + qty);
      byPeriodMap.set(period, periodMap);
    }

    const sortedTotals = [...totalByTransporter.entries()].sort((a, b) => b[1] - a[1]);
    const topNames = new Set(sortedTotals.slice(0, TOP_TRANSPORTERS_LIMIT).map(([name]) => name));
    const topTransporters = sortedTotals
      .slice(0, TOP_TRANSPORTERS_LIMIT)
      .map(([transporterCompany, totalQuantity]) => ({ transporterCompany, totalQuantity }));
    const otherTotal = sortedTotals.slice(TOP_TRANSPORTERS_LIMIT).reduce((sum, [, qty]) => sum + qty, 0);
    if (otherTotal > 0) topTransporters.push({ transporterCompany: 'Other', totalQuantity: otherTotal });

    const byPeriod = [...byPeriodMap.entries()]
      .map(([period, periodMap]) => {
        const byTransporter: { transporterCompany: string; quantity: number }[] = [];
        let otherQty = 0;
        for (const [name, qty] of periodMap.entries()) {
          if (topNames.has(name)) byTransporter.push({ transporterCompany: name, quantity: qty });
          else otherQty += qty;
        }
        if (otherQty > 0) byTransporter.push({ transporterCompany: 'Other', quantity: otherQty });
        return { period, byTransporter };
      })
      .sort(periodAscending);

    return { granularity, byPeriod, topTransporters };
  }

  /** Rate of ReceptionTasks left with no confirmed delivery ('unfinished' outcome), by period and by staff. Backs the Reception Reports "Staff Reliability" section. */
  async receptionReliability(query: ReportDateRangeQuery): Promise<ReceptionReliabilityReport> {
    const { granularity, dateFilter } = resolveDateRange(query);
    const tasks = await this.prisma.receptionTask.findMany({
      where: { endedAt: { not: null }, ...(dateFilter ? { startedAt: dateFilter } : {}) },
    });

    const userIds = [...new Set(tasks.map((t) => t.userId))];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
    const nameByUserId = new Map(users.map((u) => [u.id, u.name]));

    const byPeriodTotal = new Map<string, number>();
    const byPeriodUnfinished = new Map<string, number>();
    const byStaffTotal = new Map<string, number>();
    const byStaffUnfinished = new Map<string, number>();
    const inc = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

    for (const t of tasks) {
      const period = periodKeyUTC(t.startedAt, granularity);
      inc(byPeriodTotal, period);
      inc(byStaffTotal, t.userId);
      if (t.outcome === 'unfinished') {
        inc(byPeriodUnfinished, period);
        inc(byStaffUnfinished, t.userId);
      }
    }

    const byPeriod = [...byPeriodTotal.entries()]
      .map(([period, totalCount]) => {
        const unfinishedCount = byPeriodUnfinished.get(period) ?? 0;
        return { period, unfinishedCount, totalCount, unfinishedRatePercent: percent(unfinishedCount, totalCount) };
      })
      .sort(periodAscending);

    const byStaff = [...byStaffTotal.entries()].map(([userId, totalCount]) => {
      const unfinishedCount = byStaffUnfinished.get(userId) ?? 0;
      return {
        userId,
        userName: nameByUserId.get(userId) ?? 'Unknown',
        unfinishedCount,
        totalCount,
        unfinishedRatePercent: percent(unfinishedCount, totalCount),
      };
    });

    return { granularity, byPeriod, byStaff };
  }

  async putAway(): Promise<PutAwayReport> {
    const tasks = await this.prisma.putAwayTask.findMany();
    const completed = tasks.filter((t) => t.status === 'completed' && t.durationMs !== null);

    return {
      totalTasks: tasks.length,
      completedCount: completed.length,
      issueReportedCount: tasks.filter((t) => t.status === 'issue_reported').length,
      averageCompletionMinutes: average(completed.map((t) => t.durationMs!)),
    };
  }

  async orderPrep(): Promise<OrderPrepReport> {
    const [totalSessions, tasks] = await Promise.all([
      this.prisma.orderPrepSession.count(),
      this.prisma.orderPrepTask.findMany(),
    ]);

    const summarize = (role: 'picker' | 'packer'): OrderPrepRoleStats => {
      const roleTasks = tasks.filter((t) => t.role === role);
      const completed = roleTasks.filter((t) => t.status === 'completed' && t.durationMs !== null);
      return {
        totalCount: roleTasks.length,
        completedCount: completed.length,
        averageDurationMinutes: average(completed.map((t) => t.durationMs!)),
      };
    };

    return {
      totalSessions,
      pickerTasks: summarize('picker'),
      packerTasks: summarize('packer'),
    };
  }

  /**
   * Admin's home-screen dashboard — see reports.types.ts's doc comment
   * for the live-vs-today time-scope split and the UTC-calendar-day
   * caveat.
   */
  async adminDashboard(): Promise<AdminDashboardReport> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [
      liveSummary,
      staffUsers,
      activeShifts,
      shiftsToday,
      receptionsToday,
      palletsLoggedTodayCount,
      putAwayCompletedToday,
      orderPrepSessionsCreatedTodayCount,
      orderPrepCompletedToday,
    ] = await Promise.all([
      this.overview(),
      this.prisma.user.findMany({ where: { role: 'staff' } }),
      this.prisma.shift.findMany({ where: { endedAt: null } }),
      this.prisma.shift.findMany({ where: { startedAt: { gte: startOfDay } } }),
      this.prisma.reception.findMany({ where: { arrivedAt: { gte: startOfDay } } }),
      this.prisma.sellerStockPallet.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.putAwayTask.findMany({ where: { status: 'completed', completedAt: { gte: startOfDay } } }),
      this.prisma.orderPrepSession.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.orderPrepTask.findMany({ where: { status: 'completed', completedAt: { gte: startOfDay } } }),
    ]);

    const activeShiftByUser = new Map(activeShifts.map((s) => [s.userId, s]));

    // A separate query for *all* (not just open) breaks on currently-active
    // shifts — needed to compute cumulative short-break usage, which isn't
    // guaranteed to be covered by breaksToday alone (an active shift that
    // started before today's UTC boundary wouldn't be in shiftsToday at all).
    const [breaksToday, activeShiftBreaks] = await Promise.all([
      this.prisma.break.findMany({ where: { shiftId: { in: shiftsToday.map((s) => s.id) } } }),
      this.prisma.break.findMany({ where: { shiftId: { in: activeShifts.map((s) => s.id) } } }),
    ]);
    const breakMsByShift = sumBreakMsByShift(breaksToday);
    const shortBreakMsByShift = sumShortBreakMsByShift(activeShiftBreaks, now);
    const activeBreakByShiftId = new Map(activeShiftBreaks.filter((b) => !b.endedAt).map((b) => [b.shiftId, b]));

    const shiftsTodayByUser = new Map<string, { count: number; totalMs: number }>();
    for (const shift of shiftsToday) {
      const existing = shiftsTodayByUser.get(shift.userId) ?? { count: 0, totalMs: 0 };
      existing.count += 1;
      if (shift.endedAt) {
        existing.totalMs += shift.endedAt.getTime() - shift.startedAt.getTime() - (breakMsByShift.get(shift.id) ?? 0);
      }
      shiftsTodayByUser.set(shift.userId, existing);
    }

    const countByUser = (tasks: { assignedToUserId: string }[]): Map<string, number> => {
      const map = new Map<string, number>();
      for (const task of tasks) {
        map.set(task.assignedToUserId, (map.get(task.assignedToUserId) ?? 0) + 1);
      }
      return map;
    };
    const putAwayCountByUser = countByUser(putAwayCompletedToday);
    const orderPrepCountByUser = countByUser(orderPrepCompletedToday);

    const staff: StaffStatus[] = staffUsers
      .map((user) => {
        const activeShift = activeShiftByUser.get(user.id);
        const todayStats = shiftsTodayByUser.get(user.id);
        const activeBreak = activeShift ? activeBreakByShiftId.get(activeShift.id) : undefined;
        const shortBreakUsedMs = activeShift ? (shortBreakMsByShift.get(activeShift.id) ?? 0) : 0;
        return {
          userId: user.id,
          userName: user.name,
          onShift: !!activeShift,
          shiftStartedAt: activeShift ? activeShift.startedAt.toISOString() : null,
          onBreak: !!activeBreak,
          breakType: activeBreak?.type ?? null,
          breakStartedAt: activeBreak ? activeBreak.startedAt.toISOString() : null,
          shortBreakRemainingMs:
            activeBreak?.type === 'short' ? Math.max(0, SHORT_BREAK_LIMIT_MS - shortBreakUsedMs) : null,
          lunchBreakRemainingMs:
            activeBreak?.type === 'lunch'
              ? LUNCH_BREAK_SUGGESTED_DURATION_MS - (Date.now() - activeBreak.startedAt.getTime())
              : null,
          shiftsToday: todayStats?.count ?? 0,
          hoursWorkedToday: todayStats ? Math.round((todayStats.totalMs / 3_600_000) * 10) / 10 : 0,
          putAwayCompletedToday: putAwayCountByUser.get(user.id) ?? 0,
          orderPrepCompletedToday: orderPrepCountByUser.get(user.id) ?? 0,
        };
      })
      .sort((a, b) => (a.onShift !== b.onShift ? (a.onShift ? -1 : 1) : a.userName.localeCompare(b.userName)));

    return {
      date: now.toISOString().slice(0, 10),
      liveSummary: {
        staffOnShiftCount: liveSummary.staffOnShiftCount,
        totalStaffCount: liveSummary.totalStaffCount,
        palletsPendingReviewCount: liveSummary.palletsPendingReviewCount,
        openPutAwayTaskCount: liveSummary.openPutAwayTaskCount,
        activeOrderPrepSessionCount: liveSummary.activeOrderPrepSessionCount,
      },
      today: {
        receptionsLoggedCount: receptionsToday.length,
        receptionsCompletedCount: receptionsToday.filter((r) => r.status === 'completed').length,
        palletsLoggedCount: palletsLoggedTodayCount,
        putAwayCompletedCount: putAwayCompletedToday.length,
        orderPrepSessionsCreatedCount: orderPrepSessionsCreatedTodayCount,
      },
      staff,
    };
  }

  /**
   * Manual "snapshot" export — writes the current numbers from every
   * report to 3 sheet tabs, tagged with an export timestamp. Each call
   * appends new rows rather than overwriting, so re-running this over
   * time builds a historical trend log directly in the spreadsheet.
   * Uses the same never-throws SheetsService as Shifts/Receptions' own
   * exports — a Sheets outage shouldn't turn a report screen into an error.
   */
  async exportSnapshotToSheets(): Promise<void> {
    const [overview, attendance, reception, putAway, orderPrep] = await Promise.all([
      this.overview(),
      this.attendance(),
      this.reception(),
      this.putAway(),
      this.orderPrep(),
    ]);
    const exportedAt = formatTimestampForSheet(new Date());

    await Promise.all([
      this.sheetsService.appendRow(
        'Dashboard Snapshot',
        [
          'Exported At',
          'Staff On Shift',
          'Total Staff',
          'Pallets Pending Review',
          'Open Put-Away Tasks',
          'Active Order-Prep Sessions',
          'Put-Away Completed',
          'Put-Away Issues Reported',
          'Put-Away Avg Completion (min)',
          'Picker Avg Duration (min)',
          'Packer Avg Duration (min)',
        ],
        [
          exportedAt,
          overview.staffOnShiftCount,
          overview.totalStaffCount,
          overview.palletsPendingReviewCount,
          overview.openPutAwayTaskCount,
          overview.activeOrderPrepSessionCount,
          putAway.completedCount,
          putAway.issueReportedCount,
          putAway.averageCompletionMinutes ?? '',
          orderPrep.pickerTasks.averageDurationMinutes ?? '',
          orderPrep.packerTasks.averageDurationMinutes ?? '',
        ],
      ),
      this.sheetsService.appendRows(
        'Attendance Snapshot',
        ['Exported At', 'User', 'Total Shifts', 'Total Hours Worked'],
        attendance.rows.map((row) => [exportedAt, row.userName, row.totalShifts, row.totalHoursWorked]),
      ),
      this.sheetsService.appendRows(
        'Reception Snapshot',
        ['Exported At', 'Category', 'Total', 'Completed', 'Avg Processing (min)', 'Flagged'],
        reception.categories.map((c) => [
          exportedAt,
          c.category,
          c.totalCount,
          c.completedCount,
          c.averageProcessingMinutes ?? '',
          c.flaggedCount,
        ]),
      ),
    ]);
  }
}

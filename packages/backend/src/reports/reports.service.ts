import { Injectable } from '@nestjs/common';

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
  type StaffActivityEntry,
  type StaffActivityReport,
  type StaffActivityScope,
  type StaffHistoryCumulative,
  type StaffHistoryDay,
  type StaffHistoryReport,
  type StaffStatus,
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
   * Backs the web dashboard's "Staff History" section — a planned vs.
   * actual day-by-day grid, one column per day since the app's very
   * first completed shift. "Planned" comes from each staff member's
   * *current* StaffSchedule applied retroactively to every day (no
   * history of past schedule changes is kept, so a schedule edited
   * partway through is a known, accepted simplification — same
   * "current config applied to history" trade-off used elsewhere, e.g.
   * ReferenceListValue renames). A day outside the staff member's
   * working days, or with no schedule configured at all, plans 0 hours.
   */
  async staffHistory(): Promise<StaffHistoryReport> {
    const [staffUsers, schedules, completedShifts] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'staff' } }),
      this.prisma.staffSchedule.findMany(),
      this.prisma.shift.findMany({ where: { endedAt: { not: null } } }),
    ]);

    const zeroCumulative = (): StaffHistoryCumulative => ({
      plannedHours: 0,
      actualHours: 0,
      floorTaskHours: 0,
      receptionHours: 0,
      openPoolHours: 0,
      urgentTaskHours: 0,
    });

    if (completedShifts.length === 0) {
      return {
        days: [],
        staff: staffUsers.map((u) => ({ userId: u.id, userName: u.name, days: {}, cumulative: zeroCumulative() })),
      };
    }

    const [breaks, floorTasks, receptionTasks, openPoolTasks, directives] = await Promise.all([
      this.prisma.break.findMany({ where: { shiftId: { in: completedShifts.map((s) => s.id) } } }),
      this.prisma.floorTaskLog.findMany({ where: { endedAt: { not: null } } }),
      this.prisma.receptionTask.findMany({ where: { endedAt: { not: null } } }),
      this.prisma.openPoolTask.findMany({ where: { claimedByUserId: { not: null }, completedAt: { not: null } } }),
      this.prisma.directive.findMany({ where: { receivedByUserId: { not: null }, resolvedAt: { not: null } } }),
    ]);
    const breakMsByShift = sumBreakMsByShift(breaks);
    const scheduleByUserId = new Map(schedules.map((s) => [s.userId, s]));

    const earliestMs = Math.min(...completedShifts.map((s) => s.startedAt.getTime()));
    const days = enumerateDaysUTC(dateKeyUTC(new Date(earliestMs)), dateKeyUTC(new Date()));

    const actualHoursByUserDay = new Map<string, Map<string, number>>();
    for (const shift of completedShifts) {
      const day = dateKeyUTC(shift.startedAt);
      const durationMs = shift.endedAt!.getTime() - shift.startedAt.getTime() - (breakMsByShift.get(shift.id) ?? 0);
      const userDays = actualHoursByUserDay.get(shift.userId) ?? new Map<string, number>();
      userDays.set(day, (userDays.get(day) ?? 0) + durationMs / 3_600_000);
      actualHoursByUserDay.set(shift.userId, userDays);
    }

    /** `startedAt`-bucketed, endedAt-set rows only — mirrors FloorTaskLog.end()'s duration calc (fold any still-open pause back in before subtracting). */
    function bucketByStartDay<T extends { userId: string; startedAt: Date; endedAt: Date | null; pausedAt: Date | null; totalPausedMs: number }>(
      rows: T[],
    ): Map<string, Map<string, number>> {
      const byUserDay = new Map<string, Map<string, number>>();
      for (const row of rows) {
        if (!row.endedAt) continue;
        const openPauseMs = row.pausedAt ? row.endedAt.getTime() - row.pausedAt.getTime() : 0;
        const durationMs = row.endedAt.getTime() - row.startedAt.getTime() - row.totalPausedMs - openPauseMs;
        const day = dateKeyUTC(row.startedAt);
        const userDays = byUserDay.get(row.userId) ?? new Map<string, number>();
        userDays.set(day, (userDays.get(day) ?? 0) + durationMs / 3_600_000);
        byUserDay.set(row.userId, userDays);
      }
      return byUserDay;
    }

    const floorTaskHoursByUserDay = bucketByStartDay(floorTasks);
    const receptionHoursByUserDay = bucketByStartDay(receptionTasks);

    const openPoolHoursByUserDay = new Map<string, Map<string, number>>();
    for (const task of openPoolTasks) {
      const durationMs = task.completedAt!.getTime() - task.claimedAt!.getTime();
      const day = dateKeyUTC(task.claimedAt!);
      const userDays = openPoolHoursByUserDay.get(task.claimedByUserId!) ?? new Map<string, number>();
      userDays.set(day, (userDays.get(day) ?? 0) + durationMs / 3_600_000);
      openPoolHoursByUserDay.set(task.claimedByUserId!, userDays);
    }

    const urgentTaskHoursByUserDay = new Map<string, Map<string, number>>();
    for (const directive of directives) {
      const durationMs = directive.resolvedAt!.getTime() - directive.receivedAt!.getTime();
      const day = dateKeyUTC(directive.receivedAt!);
      const userDays = urgentTaskHoursByUserDay.get(directive.receivedByUserId!) ?? new Map<string, number>();
      userDays.set(day, (userDays.get(day) ?? 0) + durationMs / 3_600_000);
      urgentTaskHoursByUserDay.set(directive.receivedByUserId!, userDays);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const staff = staffUsers.map((user) => {
      const schedule = scheduleByUserId.get(user.id);
      const userActualDays = actualHoursByUserDay.get(user.id);
      const userFloorTaskDays = floorTaskHoursByUserDay.get(user.id);
      const userReceptionDays = receptionHoursByUserDay.get(user.id);
      const userOpenPoolDays = openPoolHoursByUserDay.get(user.id);
      const userUrgentTaskDays = urgentTaskHoursByUserDay.get(user.id);

      const dayEntries: Record<string, StaffHistoryDay> = {};
      const cumulative = zeroCumulative();
      for (const day of days) {
        const weekday = WEEKDAY_BY_UTC_DAY_INDEX[new Date(`${day}T00:00:00.000Z`).getUTCDay()];
        const plannedHours = schedule && schedule.workingDays.includes(weekday) ? schedule.requiredWorkingHours : 0;
        const entry: StaffHistoryDay = {
          plannedHours,
          actualHours: round2(userActualDays?.get(day) ?? 0),
          floorTaskHours: round2(userFloorTaskDays?.get(day) ?? 0),
          receptionHours: round2(userReceptionDays?.get(day) ?? 0),
          openPoolHours: round2(userOpenPoolDays?.get(day) ?? 0),
          urgentTaskHours: round2(userUrgentTaskDays?.get(day) ?? 0),
        };
        dayEntries[day] = entry;
        cumulative.plannedHours = round2(cumulative.plannedHours + entry.plannedHours);
        cumulative.actualHours = round2(cumulative.actualHours + entry.actualHours);
        cumulative.floorTaskHours = round2(cumulative.floorTaskHours + entry.floorTaskHours);
        cumulative.receptionHours = round2(cumulative.receptionHours + entry.receptionHours);
        cumulative.openPoolHours = round2(cumulative.openPoolHours + entry.openPoolHours);
        cumulative.urgentTaskHours = round2(cumulative.urgentTaskHours + entry.urgentTaskHours);
      }
      return { userId: user.id, userName: user.name, days: dayEntries, cumulative };
    });

    return { days, staff };
  }

  /**
   * Backs the web dashboard's "Staff Activity" section — see
   * StaffActivityEntry's doc comment for why this merges 4 sources.
   * `scope: 'live'` reads each source's in-progress rows; `'recent'`
   * reads their most recently *finished* rows instead (capped at
   * STAFF_ACTIVITY_RECENT_LIMIT, newest-first) — the only place a
   * completed Dispatch Floor Task's scannedBarcode is visible to Admin.
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
    const users = await this.prisma.user.findMany({ where: { id: { in: [...userIds] } } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const nameFor = (userId: string) => nameById.get(userId) ?? 'Unknown';

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
        }),
      ),
    ];

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

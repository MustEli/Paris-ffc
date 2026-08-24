import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { type ReceptionCategory } from '../receptions/reception.types';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import {
  type AttendanceReport,
  type OrderPrepReport,
  type OrderPrepRoleStats,
  type OverviewReport,
  type PutAwayReport,
  type ReceptionReport,
} from './reports.types';

const RECEPTION_CATEGORIES: ReceptionCategory[] = [
  'return_parcels',
  'packaging_stock',
  'sellers_stock',
  'equipment_other',
];

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length / 60_000) * 10) / 10; // ms -> minutes, 1 decimal place
}

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

    const totals = new Map<string, { totalShifts: number; totalMs: number }>();
    for (const shift of completedShifts) {
      const durationMs = shift.endedAt!.getTime() - shift.startedAt.getTime();
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

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { type Shift as PrismaShift } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { parseHHMM } from './schedule.types';

/** How often this checks every active shift against its schedule. Cheap query, no reason to run more often than the hours-complete check needs. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Best-effort reminder layer on top of StaffSchedule — fires at most once
 * per shift (tracked via Shift.hoursCompleteAt) over the RealtimeService
 * socket layer. Never blocks or changes any actual shift/break state; a
 * staff member with no schedule configured, or who isn't connected when
 * the event fires, simply doesn't get a reminder — same
 * degrade-gracefully pattern as every other optional feature in this app
 * (SheetsService, etc.). Per-shift errors are logged and skipped, never
 * allowed to stop the rest of the tick.
 */
@Injectable()
export class ScheduleAlertsService {
  private readonly logger = new Logger(ScheduleAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Interval(CHECK_INTERVAL_MS)
  async checkActiveShifts(): Promise<void> {
    const activeShifts = await this.prisma.shift.findMany({ where: { endedAt: null } });
    for (const shift of activeShifts) {
      try {
        await this.checkOne(shift);
      } catch (err) {
        this.logger.warn(`Schedule alert check failed for shift ${shift.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async checkOne(shift: PrismaShift): Promise<void> {
    const schedule = await this.prisma.staffSchedule.findUnique({ where: { userId: shift.userId } });
    if (!schedule) return;

    const now = new Date();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    if (!shift.hoursCompleteAt) {
      const unpaidBreakMs = await this.unpaidBreakMsSoFar(shift.id, now);
      const netWorkedMs = now.getTime() - shift.startedAt.getTime() - unpaidBreakMs;
      if (netWorkedMs >= schedule.requiredWorkingHours * 3_600_000) {
        const isBeforeScheduledEnd = nowMinutes < parseHHMM(schedule.shiftEndTime);
        this.realtimeService.emitToUser(shift.userId, 'schedule:hours_complete', {
          requiredWorkingHours: schedule.requiredWorkingHours,
          isBeforeScheduledEnd,
          shiftEndTime: schedule.shiftEndTime,
        });
        await this.prisma.shift.update({ where: { id: shift.id }, data: { hoursCompleteAt: now } });
      }
    }
  }

  private async unpaidBreakMsSoFar(shiftId: string, now: Date): Promise<number> {
    const breaks = await this.prisma.break.findMany({ where: { shiftId, type: 'lunch' } });
    return breaks.reduce((total, b) => total + ((b.endedAt ?? now).getTime() - b.startedAt.getTime()), 0);
  }
}

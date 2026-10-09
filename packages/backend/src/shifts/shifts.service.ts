import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Break as PrismaBreak, type Shift as PrismaShift } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import { UsersService } from '../users/users.service';
import {
  LUNCH_BREAK_SUGGESTED_DURATION_MS,
  SHORT_BREAK_LIMIT_MS,
  type Break,
  type BreakType,
  type Shift,
  type ShiftStatus,
  type WorkAvailability,
} from './shift.types';

const SHEET_TAB = 'Attendance';
const SHEET_HEADER = ['User', 'Shift Start (Local)', 'Shift End (Local)', 'Break Minutes', 'Hours Worked (Net)'];

/**
 * If a shift's last heartbeat (or its startedAt, if none has landed yet)
 * is older than this, the app is assumed to have been closed without
 * "End Shift" ever being pressed — see getEffectiveActiveShift(). The
 * mobile app sends a heartbeat every ~15 min while a shift is active and
 * the app is open, so 30 minutes was originally used here — but that
 * turned out to be far too tight in practice: this is the *only* signal
 * used to decide "was the app actually closed," and a tolerance that
 * short meant any brief real-world gap (not just a closed app) started
 * to look the same as an abandoned shift. There used to also be a
 * separate, more aggressive mechanism that ended a shift the instant
 * the app backgrounded at all — removed entirely (see
 * useShiftLifecycle.ts on mobile) after it started firing on ordinary
 * in-app back-button navigation, not just real backgrounding. 3 hours
 * is deliberately generous: nobody legitimately working a shift goes
 * 3 hours without the app sending a single heartbeat, so this only
 * ever fires for a genuinely closed/killed app.
 */
const HEARTBEAT_STALE_TOLERANCE_MS = 3 * 60 * 60_000;

/** Sums only unpaid (lunch) completed breaks — short breaks are paid and never subtracted from worked hours. An open break shouldn't exist by the time this is called (endShift auto-closes it), but this stays defensive rather than crashing on a data glitch. */
function sumUnpaidBreakMs(breaks: { type: BreakType; startedAt: Date; endedAt: Date | null }[]): number {
  return breaks.reduce(
    (total, b) => (b.type === 'lunch' && b.endedAt ? total + (b.endedAt.getTime() - b.startedAt.getTime()) : total),
    0,
  );
}

/** Backed by Postgres via Prisma now — see users.service.ts for the pattern and why. */
@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
    private readonly usersService: UsersService,
  ) {}

  private toDomain(row: PrismaShift): Shift {
    return {
      id: row.id,
      userId: row.userId,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    };
  }

  private toBreakDomain(row: PrismaBreak): Break {
    return {
      id: row.id,
      shiftId: row.shiftId,
      type: row.type,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    };
  }

  private findActiveShift(userId: string) {
    return this.prisma.shift.findFirst({ where: { userId, endedAt: null } });
  }

  private findActiveBreak(shiftId: string) {
    return this.prisma.break.findFirst({ where: { shiftId, endedAt: null } });
  }

  /**
   * The one place every read of "is this user on shift" goes through.
   * Besides fetching the active shift, it lazily auto-ends one that's
   * gone stale (no heartbeat within tolerance) — see the constant's doc
   * comment above for why this is a lazy/on-read check rather than a
   * background job (none exists in this app). Called on every status
   * check, and by ActiveShiftGuard before any staff action.
   */
  private async getEffectiveActiveShift(userId: string): Promise<PrismaShift | null> {
    const shift = await this.findActiveShift(userId);
    if (!shift) return null;

    const lastSignal = shift.lastHeartbeatAt ?? shift.startedAt;
    const staleCutoff = Date.now() - HEARTBEAT_STALE_TOLERANCE_MS;
    if (lastSignal.getTime() >= staleCutoff) {
      return shift;
    }

    // Stale — the app almost certainly closed without "End Shift" being
    // pressed. End it as of the last real signal we have, not "now":
    // crediting worked time all the way up to the moment we happened to
    // notice would over-count however long it sat unnoticed.
    await this.endShiftInternal(shift, lastSignal);
    return null;
  }

  async startShift(userId: string): Promise<Shift> {
    if (await this.findActiveShift(userId)) {
      throw new ConflictException({
        message: 'Shift already in progress — clock out before starting a new one',
        code: 'shift.already_active',
      });
    }

    const now = new Date();
    const shift = await this.prisma.shift.create({
      data: { id: randomUUID(), userId, startedAt: now, endedAt: null, lastHeartbeatAt: now },
    });
    return this.toDomain(shift);
  }

  async endShift(userId: string): Promise<Shift> {
    const shift = await this.findActiveShift(userId);
    if (!shift) {
      throw new NotFoundException({ message: 'No active shift to end', code: 'shift.not_active' });
    }
    return this.toDomain(await this.endShiftInternal(shift, new Date()));
  }

  /** Shared by the real "End Shift" call and the stale-shift auto-end path. */
  private async endShiftInternal(shift: PrismaShift, endedAt: Date): Promise<PrismaShift> {
    // Clocking out ends any open break too — there's no such thing as
    // "still on break" once the shift itself is over.
    const openBreak = await this.findActiveBreak(shift.id);
    if (openBreak) {
      await this.prisma.break.update({ where: { id: openBreak.id }, data: { endedAt } });
    }

    // Same for a still-open Floor Task — direct Prisma access rather
    // than importing FloorTasksModule, which already imports this
    // module (for ActiveShiftGuard) and would make it circular. Folds
    // any open pause into totalPausedMs exactly like a normal Stop
    // would, via the same force-close path, not FloorTasksService's
    // validated end() — there's no form left open to validate against.
    const openFloorTask = await this.prisma.floorTaskLog.findFirst({ where: { userId: shift.userId, endedAt: null } });
    if (openFloorTask) {
      const stillOpenPauseMs = openFloorTask.pausedAt ? endedAt.getTime() - openFloorTask.pausedAt.getTime() : 0;
      await this.prisma.floorTaskLog.update({
        where: { id: openFloorTask.id },
        data: { endedAt, pausedAt: null, totalPausedMs: { increment: stillOpenPauseMs } },
      });
    }

    const updated = await this.prisma.shift.update({ where: { id: shift.id }, data: { endedAt } });

    // Doc's Feature 1: "documented in a Google Sheet." Fire-and-forget
    // is unnecessary — SheetsService.appendRow never throws and is an
    // instant no-op when unconfigured, so awaiting it costs nothing
    // when disabled and only a real network round-trip when enabled.
    const [user, allBreaks] = await Promise.all([
      this.usersService.findById(shift.userId),
      this.prisma.break.findMany({ where: { shiftId: shift.id } }),
    ]);
    const unpaidBreakMs = sumUnpaidBreakMs(allBreaks);
    const breakMinutes = Math.round(unpaidBreakMs / 60_000);
    const netHoursWorked =
      Math.round(((updated.endedAt!.getTime() - updated.startedAt.getTime() - unpaidBreakMs) / 3_600_000) * 10) / 10;

    await this.sheetsService.appendRow(SHEET_TAB, SHEET_HEADER, [
      user?.name ?? shift.userId,
      formatTimestampForSheet(updated.startedAt),
      formatTimestampForSheet(updated.endedAt!),
      breakMinutes,
      netHoursWorked,
    ]);

    return updated;
  }

  /** Cumulative "short" break time for a shift, including any currently in progress (counted up to `now`). */
  private async shortBreakUsedMs(shiftId: string, now: Date): Promise<number> {
    const breaks = await this.prisma.break.findMany({ where: { shiftId, type: 'short' } });
    return breaks.reduce((total, b) => total + ((b.endedAt ?? now).getTime() - b.startedAt.getTime()), 0);
  }

  async getStatus(userId: string): Promise<ShiftStatus> {
    const now = new Date();
    const shift = await this.getEffectiveActiveShift(userId);
    const activeBreak = shift ? await this.findActiveBreak(shift.id) : undefined;
    const shortBreakUsedMs = shift ? await this.shortBreakUsedMs(shift.id, now) : 0;
    const lunchBreakRemainingMs =
      activeBreak?.type === 'lunch'
        ? LUNCH_BREAK_SUGGESTED_DURATION_MS - (now.getTime() - activeBreak.startedAt.getTime())
        : null;

    return {
      active: !!shift,
      shiftId: shift?.id ?? null,
      startedAt: shift ? shift.startedAt.toISOString() : null,
      onBreak: !!activeBreak,
      breakStartedAt: activeBreak ? activeBreak.startedAt.toISOString() : null,
      breakType: activeBreak?.type ?? null,
      shortBreakUsedMs,
      shortBreakRemainingMs: Math.max(0, SHORT_BREAK_LIMIT_MS - shortBreakUsedMs),
      lunchBreakRemainingMs,
    };
  }

  /**
   * Used by ActiveShiftGuard — a no-op cost for non-staff callers, since
   * it only ever runs for staff. Blocks Reception/Seller Stock/Put-Away/
   * Order-Prep both without an active shift AND while on any open break
   * (lunch or short) — staff on break can't do any work activity until
   * they end it, same as before starting a shift at all.
   */
  async checkWorkAvailability(userId: string): Promise<WorkAvailability> {
    const shift = await this.getEffectiveActiveShift(userId);
    if (!shift) {
      return { available: false, reason: 'no_active_shift' };
    }
    if (await this.findActiveBreak(shift.id)) {
      return { available: false, reason: 'on_break' };
    }
    return { available: true };
  }

  /** Refreshed every ~15 min by the app while a shift is active and the app is open — see HEARTBEAT_STALE_TOLERANCE_MS. */
  async heartbeat(userId: string): Promise<{ ok: true }> {
    const shift = await this.findActiveShift(userId);
    if (shift) {
      await this.prisma.shift.update({ where: { id: shift.id }, data: { lastHeartbeatAt: new Date() } });
    }
    return { ok: true };
  }

  /** Doc's scoped-down "Automated Break Management" — staff-initiated only, no admin-scheduled windows/reminders yet. */
  async startBreak(userId: string, type: BreakType): Promise<Break> {
    const shift = await this.getEffectiveActiveShift(userId);
    if (!shift) {
      throw new NotFoundException({ message: 'No active shift to take a break from', code: 'shift.not_active' });
    }
    if (await this.findActiveBreak(shift.id)) {
      throw new ConflictException({
        message: 'Already on a break — end it before starting another',
        code: 'shift.break_already_active',
      });
    }

    const now = new Date();
    if (type === 'short') {
      const usedMs = await this.shortBreakUsedMs(shift.id, now);
      if (usedMs >= SHORT_BREAK_LIMIT_MS) {
        throw new ConflictException({
          message: 'Short break allowance for this shift has already been used up',
          code: 'shift.short_break_used_up',
        });
      }
    }

    const brk = await this.prisma.break.create({
      data: { id: randomUUID(), shiftId: shift.id, type, startedAt: now, endedAt: null },
    });

    // Starting a break pauses a still-running floor task — same direct-
    // Prisma reasoning as endShiftInternal's cascade (avoids a circular
    // module dependency). Already paused, or nothing open at all? Then
    // there's nothing to do. Deliberately doesn't auto-resume when the
    // break ends — only asked for the pause side of this, not the
    // reverse.
    const openFloorTask = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null, pausedAt: null } });
    if (openFloorTask) {
      await this.prisma.floorTaskLog.update({ where: { id: openFloorTask.id }, data: { pausedAt: now } });
    }

    return this.toBreakDomain(brk);
  }

  async endBreak(userId: string): Promise<Break> {
    const shift = await this.getEffectiveActiveShift(userId);
    if (!shift) {
      throw new NotFoundException({ message: 'No active shift', code: 'shift.not_active' });
    }
    const activeBreak = await this.findActiveBreak(shift.id);
    if (!activeBreak) {
      throw new NotFoundException({ message: 'No break in progress to end', code: 'shift.no_break_to_end' });
    }

    const updated = await this.prisma.break.update({
      where: { id: activeBreak.id },
      data: { endedAt: new Date() },
    });
    return this.toBreakDomain(updated);
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Break as PrismaBreak, type Shift as PrismaShift } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import { UsersService } from '../users/users.service';
import { type Break, type Shift, type ShiftStatus } from './shift.types';

const SHEET_TAB = 'Attendance';
const SHEET_HEADER = ['User', 'Shift Start (Local)', 'Shift End (Local)', 'Break Minutes', 'Hours Worked (Net)'];

/** Sums completed breaks only — an open one shouldn't exist by the time this is called (endShift auto-closes it), but this stays defensive rather than crashing on a data glitch. */
function sumBreakMs(breaks: { startedAt: Date; endedAt: Date | null }[]): number {
  return breaks.reduce((total, b) => (b.endedAt ? total + (b.endedAt.getTime() - b.startedAt.getTime()) : total), 0);
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

  async startShift(userId: string): Promise<Shift> {
    if (await this.findActiveShift(userId)) {
      throw new ConflictException('Shift already in progress — clock out before starting a new one');
    }

    const shift = await this.prisma.shift.create({
      data: { id: randomUUID(), userId, startedAt: new Date(), endedAt: null },
    });
    return this.toDomain(shift);
  }

  async endShift(userId: string): Promise<Shift> {
    const shift = await this.findActiveShift(userId);
    if (!shift) {
      throw new NotFoundException('No active shift to end');
    }

    const endedAt = new Date();

    // Clocking out ends any open break too — there's no such thing as
    // "still on break" once the shift itself is over.
    const openBreak = await this.findActiveBreak(shift.id);
    if (openBreak) {
      await this.prisma.break.update({ where: { id: openBreak.id }, data: { endedAt } });
    }

    const updated = await this.prisma.shift.update({ where: { id: shift.id }, data: { endedAt } });

    // Doc's Feature 1: "documented in a Google Sheet." Fire-and-forget
    // is unnecessary — SheetsService.appendRow never throws and is an
    // instant no-op when unconfigured, so awaiting it costs nothing
    // when disabled and only a real network round-trip when enabled.
    const [user, allBreaks] = await Promise.all([
      this.usersService.findById(userId),
      this.prisma.break.findMany({ where: { shiftId: shift.id } }),
    ]);
    const breakMs = sumBreakMs(allBreaks);
    const breakMinutes = Math.round(breakMs / 60_000);
    const netHoursWorked =
      Math.round(((updated.endedAt!.getTime() - updated.startedAt.getTime() - breakMs) / 3_600_000) * 10) / 10;

    await this.sheetsService.appendRow(SHEET_TAB, SHEET_HEADER, [
      user?.name ?? userId,
      formatTimestampForSheet(updated.startedAt),
      formatTimestampForSheet(updated.endedAt!),
      breakMinutes,
      netHoursWorked,
    ]);

    return this.toDomain(updated);
  }

  async getStatus(userId: string): Promise<ShiftStatus> {
    const shift = await this.findActiveShift(userId);
    const activeBreak = shift ? await this.findActiveBreak(shift.id) : undefined;
    return {
      active: !!shift,
      shiftId: shift?.id ?? null,
      startedAt: shift ? shift.startedAt.toISOString() : null,
      onBreak: !!activeBreak,
      breakStartedAt: activeBreak ? activeBreak.startedAt.toISOString() : null,
    };
  }

  /** Doc's scoped-down "Automated Break Management" — staff-initiated only, no admin-scheduled windows/reminders yet. */
  async startBreak(userId: string): Promise<Break> {
    const shift = await this.findActiveShift(userId);
    if (!shift) {
      throw new NotFoundException('No active shift to take a break from');
    }
    if (await this.findActiveBreak(shift.id)) {
      throw new ConflictException('Already on a break — end it before starting another');
    }

    const brk = await this.prisma.break.create({
      data: { id: randomUUID(), shiftId: shift.id, startedAt: new Date(), endedAt: null },
    });
    return this.toBreakDomain(brk);
  }

  async endBreak(userId: string): Promise<Break> {
    const shift = await this.findActiveShift(userId);
    if (!shift) {
      throw new NotFoundException('No active shift');
    }
    const activeBreak = await this.findActiveBreak(shift.id);
    if (!activeBreak) {
      throw new NotFoundException('No break in progress to end');
    }

    const updated = await this.prisma.break.update({
      where: { id: activeBreak.id },
      data: { endedAt: new Date() },
    });
    return this.toBreakDomain(updated);
  }
}

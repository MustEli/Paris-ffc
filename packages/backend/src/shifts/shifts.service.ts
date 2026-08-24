import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Shift as PrismaShift } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import { UsersService } from '../users/users.service';
import { type Shift, type ShiftStatus } from './shift.types';

const SHEET_TAB = 'Attendance';
const SHEET_HEADER = ['User', 'Shift Start (Local)', 'Shift End (Local)', 'Hours Worked'];

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

  private findActiveShift(userId: string) {
    return this.prisma.shift.findFirst({ where: { userId, endedAt: null } });
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

    const updated = await this.prisma.shift.update({ where: { id: shift.id }, data: { endedAt: new Date() } });

    // Doc's Feature 1: "documented in a Google Sheet." Fire-and-forget
    // is unnecessary — SheetsService.appendRow never throws and is an
    // instant no-op when unconfigured, so awaiting it costs nothing
    // when disabled and only a real network round-trip when enabled.
    const user = await this.usersService.findById(userId);
    const hoursWorked = Math.round(((updated.endedAt!.getTime() - updated.startedAt.getTime()) / 3_600_000) * 10) / 10;
    await this.sheetsService.appendRow(SHEET_TAB, SHEET_HEADER, [
      user?.name ?? userId,
      formatTimestampForSheet(updated.startedAt),
      formatTimestampForSheet(updated.endedAt!),
      hoursWorked,
    ]);

    return this.toDomain(updated);
  }

  async getStatus(userId: string): Promise<ShiftStatus> {
    const shift = await this.findActiveShift(userId);
    return {
      active: !!shift,
      shiftId: shift?.id ?? null,
      startedAt: shift ? shift.startedAt.toISOString() : null,
    };
  }
}

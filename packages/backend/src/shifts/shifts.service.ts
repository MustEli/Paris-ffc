import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Shift as PrismaShift } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type Shift, type ShiftStatus } from './shift.types';

/** Backed by Postgres via Prisma now — see users.service.ts for the pattern and why. */
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

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

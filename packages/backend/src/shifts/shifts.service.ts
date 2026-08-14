import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { type Shift, type ShiftStatus } from './shift.types';

/**
 * TEMPORARY IN-MEMORY STORE — see users.service.ts for why. Resets on
 * every restart; swap for a real repository once persistence matters.
 */
@Injectable()
export class ShiftsService {
  private readonly shifts: Shift[] = [];

  private findActiveShift(userId: string): Shift | undefined {
    return this.shifts.find((shift) => shift.userId === userId && shift.endedAt === null);
  }

  startShift(userId: string): Shift {
    if (this.findActiveShift(userId)) {
      throw new ConflictException('Shift already in progress — clock out before starting a new one');
    }

    const shift: Shift = {
      id: randomUUID(),
      userId,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    this.shifts.push(shift);
    return shift;
  }

  endShift(userId: string): Shift {
    const shift = this.findActiveShift(userId);
    if (!shift) {
      throw new NotFoundException('No active shift to end');
    }

    shift.endedAt = new Date().toISOString();
    return shift;
  }

  getStatus(userId: string): ShiftStatus {
    const shift = this.findActiveShift(userId);
    return {
      active: !!shift,
      shiftId: shift?.id ?? null,
      startedAt: shift?.startedAt ?? null,
    };
  }
}

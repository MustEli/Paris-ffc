import { BadRequestException, Injectable } from '@nestjs/common';
import { type StaffSchedule as PrismaStaffSchedule } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { type SetScheduleDto } from './dto/set-schedule.dto';
import { type StaffSchedule } from './schedule.types';

/**
 * Admin-configured working days / shift hours / scheduled break times per
 * staff member (Admin Conf doc) — see schema.prisma's StaffSchedule doc
 * comment for what this does and doesn't change about how breaks
 * actually work. Absence of a row for a user is a valid, normal state
 * ("no schedule configured yet"), not an error.
 */
@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private toDomain(row: PrismaStaffSchedule): StaffSchedule {
    return {
      userId: row.userId,
      workingDays: row.workingDays,
      shiftStartTime: row.shiftStartTime,
      shiftEndTime: row.shiftEndTime,
      requiredWorkingHours: row.requiredWorkingHours,
      paidBreakStartTime: row.paidBreakStartTime,
      lunchBreakStartTime: row.lunchBreakStartTime,
      lunchBreakDurationMinutes: row.lunchBreakDurationMinutes,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async get(userId: string): Promise<StaffSchedule | null> {
    const row = await this.prisma.staffSchedule.findUnique({ where: { userId } });
    return row ? this.toDomain(row) : null;
  }

  async set(userId: string, dto: SetScheduleDto): Promise<StaffSchedule> {
    const target = await this.usersService.findById(userId);
    if (!target || target.role !== 'staff') {
      throw new BadRequestException('userId must reference an existing staff user');
    }

    const data = {
      workingDays: dto.workingDays,
      shiftStartTime: dto.shiftStartTime,
      shiftEndTime: dto.shiftEndTime,
      requiredWorkingHours: dto.requiredWorkingHours,
      paidBreakStartTime: dto.paidBreakStartTime ?? null,
      lunchBreakStartTime: dto.lunchBreakStartTime ?? null,
      lunchBreakDurationMinutes: dto.lunchBreakDurationMinutes ?? 60,
    };

    const row = await this.prisma.staffSchedule.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.toDomain(row);
  }
}

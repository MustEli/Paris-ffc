import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type FloorTaskLog as PrismaFloorTaskLog } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from '../users/user.types';
import { type EndFloorTaskDto } from './dto/end-floor-task.dto';
import { type ActiveFloorTask, type FloorTaskCategory, type FloorTaskLog } from './floor-task.types';

/** Categories where `count` is mandatory to end the task — matches the Staff View doc's "mandatory to end task" counters. The two warehousing categories require both a count AND a zone (below). */
const REQUIRES_COUNT: FloorTaskCategory[] = [
  'pick',
  'pack',
  'return_processing',
  'box_prep',
  'warehousing_inventory_check',
  'warehousing_location_adjustment',
  'backup_box',
  'backup_shredder',
];
const REQUIRES_ZONE: FloorTaskCategory[] = ['warehousing_inventory_check', 'warehousing_location_adjustment'];

/**
 * Staff View doc's self-serve floor tasks — see schema.prisma's
 * FloorTaskLog and floor-task.types.ts doc comments. Deliberately
 * simple: one open task per staff member at a time, staff declares
 * their own counts on end, no admin assignment or review step at all
 * ("for now we trust the employees / self declaration").
 */
@Injectable()
export class FloorTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaFloorTaskLog): FloorTaskLog {
    return {
      id: row.id,
      userId: row.userId,
      category: row.category,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      count: row.count,
      countExtra: row.countExtra,
      zone: row.zone,
      comment: row.comment,
      photoUrls: row.photoUrls,
    };
  }

  async start(userId: string, category: FloorTaskCategory): Promise<FloorTaskLog> {
    const existingOpen = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null } });
    if (existingOpen) {
      throw new ConflictException('Already have an open floor task — end it before starting another');
    }
    const row = await this.prisma.floorTaskLog.create({
      data: { id: randomUUID(), userId, category, startedAt: new Date(), endedAt: null },
    });
    return this.toDomain(row);
  }

  private async findOneRow(id: string): Promise<PrismaFloorTaskLog> {
    const row = await this.prisma.floorTaskLog.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Floor task not found');
    }
    return row;
  }

  async end(id: string, user: PublicUser, dto: EndFloorTaskDto): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    if (task.userId !== user.id) {
      throw new ForbiddenException('This floor task is not yours');
    }
    if (task.endedAt) {
      throw new ConflictException('This floor task has already ended');
    }

    if (REQUIRES_COUNT.includes(task.category) && dto.count === undefined) {
      throw new BadRequestException(`count is required to end a "${task.category}" floor task`);
    }
    if (REQUIRES_ZONE.includes(task.category) && !dto.zone) {
      throw new BadRequestException(`zone is required to end a "${task.category}" floor task`);
    }
    if (task.category === 'backup_other' && !dto.comment) {
      throw new BadRequestException('comment is required to end a "backup_other" floor task');
    }

    const row = await this.prisma.floorTaskLog.update({
      where: { id },
      data: {
        endedAt: new Date(),
        count: dto.count ?? null,
        countExtra: dto.countExtra ?? null,
        zone: dto.zone ?? null,
        comment: dto.comment ?? null,
        photoUrls: dto.photoUrls ?? [],
      },
    });
    return this.toDomain(row);
  }

  async findMine(userId: string): Promise<FloorTaskLog[]> {
    const rows = await this.prisma.floorTaskLog.findMany({ where: { userId }, orderBy: { startedAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findMineOpen(userId: string): Promise<FloorTaskLog | null> {
    const row = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  /** Admin's live view: "who's on what — duration since start and declared counts so far" (Admin Conf / Integration docs) — no review/action needed from her, just visibility. */
  async findAllActive(): Promise<ActiveFloorTask[]> {
    const rows = await this.prisma.floorTaskLog.findMany({ where: { endedAt: null }, orderBy: { startedAt: 'asc' } });
    if (rows.length === 0) return [];

    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
    const nameByUserId = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((row) => ({
      ...this.toDomain(row),
      userName: nameByUserId.get(row.userId) ?? 'Unknown',
    }));
  }
}

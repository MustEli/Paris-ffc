import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type FloorTaskLog as PrismaFloorTaskLog } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from '../users/user.types';
import { type EndFloorTaskDto } from './dto/end-floor-task.dto';
import { type ActiveFloorTask, type FloorTaskCategory, type FloorTaskLog } from './floor-task.types';

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
      pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
      totalPausedMs: row.totalPausedMs,
    };
  }

  async start(userId: string, category: FloorTaskCategory): Promise<FloorTaskLog> {
    // 'box_prep' was merged into 'backup_box' (see floor-task.types.ts) —
    // kept in the type/enum for historical rows, but no new one may be
    // created under it even if an old client still sends it.
    if (category === 'box_prep') {
      throw new BadRequestException('"box_prep" has been merged into "backup_box" — use that category instead');
    }
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

  private assertOwnedAndOpen(task: PrismaFloorTaskLog, user: PublicUser): void {
    if (task.userId !== user.id) {
      throw new ForbiddenException('This floor task is not yours');
    }
    if (task.endedAt) {
      throw new ConflictException('This floor task has already ended');
    }
  }

  /** Pulled away for ad-hoc work mid-task — pausing (not ending) keeps duration reporting honest, see totalPausedMs. */
  async pause(id: string, user: PublicUser): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (task.pausedAt) {
      throw new ConflictException('This floor task is already paused');
    }
    const row = await this.prisma.floorTaskLog.update({ where: { id }, data: { pausedAt: new Date() } });
    return this.toDomain(row);
  }

  async resume(id: string, user: PublicUser): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (!task.pausedAt) {
      throw new ConflictException('This floor task is not paused');
    }
    const pausedMs = Date.now() - task.pausedAt.getTime();
    const row = await this.prisma.floorTaskLog.update({
      where: { id },
      data: { pausedAt: null, totalPausedMs: { increment: pausedMs } },
    });
    return this.toDomain(row);
  }

  /**
   * Deliberately no required-field validation — Stop must always
   * succeed, whatever is or isn't filled in, full stop (an earlier
   * version rejected this with 400s, which a real accidental-start
   * couldn't actually get past; staff can always start a fresh one of
   * the same category afterward if this one went out with incomplete
   * data).
   */
  async end(id: string, user: PublicUser, dto: EndFloorTaskDto): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);

    // Ending while still paused is allowed (no need to force a resume
    // first) — fold the open pause into totalPausedMs so it isn't lost.
    const stillOpenPauseMs = task.pausedAt ? Date.now() - task.pausedAt.getTime() : 0;

    const row = await this.prisma.floorTaskLog.update({
      where: { id },
      data: {
        endedAt: new Date(),
        count: dto.count ?? null,
        countExtra: dto.countExtra ?? null,
        zone: dto.zone ?? null,
        comment: dto.comment ?? null,
        photoUrls: dto.photoUrls ?? [],
        pausedAt: null,
        totalPausedMs: { increment: stillOpenPauseMs },
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

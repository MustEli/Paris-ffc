import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type FloorTaskLog as PrismaFloorTaskLog } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from '../users/user.types';
import { type EndFloorTaskDto } from './dto/end-floor-task.dto';
import {
  type ActiveFloorTask,
  FLOOR_TASK_CANCEL_NO_TRACE_WINDOW_MS,
  FLOOR_TASK_MAX_PAUSED,
  type FloorTaskCategory,
  type FloorTaskLog,
} from './floor-task.types';

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
      scannedBarcode: row.scannedBarcode,
      pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
      totalPausedMs: row.totalPausedMs,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    };
  }

  async start(userId: string, category: FloorTaskCategory): Promise<FloorTaskLog> {
    // 'box_prep' was merged into 'backup_box' (see floor-task.types.ts) —
    // kept in the type/enum for historical rows, but no new one may be
    // created under it even if an old client still sends it.
    if (category === 'box_prep') {
      throw new BadRequestException({
        message: '"box_prep" has been merged into "backup_box" — use that category instead',
        code: 'floor_task.box_prep_merged',
      });
    }
    // Only an actively-*running* task blocks starting another — a
    // merely-paused one doesn't (business owner's request: pausing one
    // to go do something else should be possible, up to
    // FLOOR_TASK_MAX_PAUSED parked at once — see pause() below for that
    // cap). Used to block on ANY open task regardless of pausedAt.
    const existingOpen = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null, pausedAt: null } });
    if (existingOpen) {
      throw new ConflictException({
        message: 'Already have a running floor task — pause or end it before starting another',
        code: 'floor_task.already_open',
      });
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
      throw new ForbiddenException({ message: 'This floor task is not yours', code: 'floor_task.not_yours' });
    }
    if (task.endedAt) {
      throw new ConflictException({ message: 'This floor task has already ended', code: 'floor_task.already_ended' });
    }
  }

  /**
   * Pulled away for ad-hoc work mid-task — pausing (not ending) keeps
   * duration reporting honest, see totalPausedMs. Capped at
   * FLOOR_TASK_MAX_PAUSED parked tasks at once (not counting this one,
   * which is about to become the Nth) — business owner's request, so
   * unfinished work can't pile up without bound once starting a new
   * category while one is paused became possible (see start() above).
   */
  async pause(id: string, user: PublicUser): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (task.pausedAt) {
      throw new ConflictException({ message: 'This floor task is already paused', code: 'floor_task.already_paused' });
    }
    const otherPausedCount = await this.prisma.floorTaskLog.count({
      where: { userId: user.id, endedAt: null, pausedAt: { not: null }, id: { not: id } },
    });
    if (otherPausedCount >= FLOOR_TASK_MAX_PAUSED) {
      throw new ConflictException({
        message: `You already have ${FLOOR_TASK_MAX_PAUSED} paused tasks — finish one before parking another`,
        code: 'floor_task.max_paused_reached',
      });
    }
    const row = await this.prisma.floorTaskLog.update({ where: { id }, data: { pausedAt: new Date() } });
    return this.toDomain(row);
  }

  /**
   * "Never mind, I didn't mean to start this" — available for every
   * category, any time the task is open (running or paused), not just
   * Dispatch. Under FLOOR_TASK_CANCEL_NO_TRACE_WINDOW_MS since start,
   * the row is deleted outright (no trace anywhere); at or past it, the
   * row is kept and marked cancelledAt instead — still excluded from
   * worked-hours totals (see ReportsService.computeActivityBreakdowns),
   * but visible to Admin in Staff Activity's 'recent' scope so
   * abandoned work isn't silently invisible once real time has gone
   * into it.
   */
  async cancel(id: string, user: PublicUser): Promise<{ deleted: boolean }> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);

    const elapsedMs = Date.now() - task.startedAt.getTime();
    if (elapsedMs < FLOOR_TASK_CANCEL_NO_TRACE_WINDOW_MS) {
      await this.prisma.floorTaskLog.delete({ where: { id } });
      return { deleted: true };
    }

    const stillOpenPauseMs = task.pausedAt ? Date.now() - task.pausedAt.getTime() : 0;
    await this.prisma.floorTaskLog.update({
      where: { id },
      data: {
        endedAt: new Date(),
        cancelledAt: new Date(),
        pausedAt: null,
        totalPausedMs: { increment: stillOpenPauseMs },
      },
    });
    return { deleted: false };
  }

  /**
   * Called when a staff member accepts a Directive or claims an Open
   * Pool task — auto-pauses whatever Floor Task they're currently
   * running, so they aren't implicitly doing two things at once. A
   * plain no-op if they have no open task, or it's already paused;
   * never throws, since this is a side effect of someone else's action,
   * not something the caller should be able to fail on.
   */
  async pauseIfRunning(userId: string): Promise<void> {
    const task = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null, pausedAt: null } });
    if (!task) return;
    await this.prisma.floorTaskLog.update({ where: { id: task.id }, data: { pausedAt: new Date() } });
  }

  async resume(id: string, user: PublicUser): Promise<FloorTaskLog> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (!task.pausedAt) {
      throw new ConflictException({ message: 'This floor task is not paused', code: 'floor_task.not_paused' });
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
        scannedBarcode: dto.scannedBarcode ?? null,
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

  /** The one actively-*running* (not paused) task, if any — used by things that only care about "what's live right now" (e.g. the global indicator pill). Use findMineOpenAll for the full open set, paused ones included. */
  async findMineOpen(userId: string): Promise<FloorTaskLog | null> {
    const row = await this.prisma.floorTaskLog.findFirst({ where: { userId, endedAt: null, pausedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  /** Every currently-open task (running or paused) — up to 1 running + FLOOR_TASK_MAX_PAUSED paused, now that pausing one no longer blocks starting another. */
  async findMineOpenAll(userId: string): Promise<FloorTaskLog[]> {
    const rows = await this.prisma.floorTaskLog.findMany({ where: { userId, endedAt: null }, orderBy: { startedAt: 'asc' } });
    return rows.map((row) => this.toDomain(row));
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

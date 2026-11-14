import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type ReceptionTask as PrismaReceptionTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from '../users/user.types';
import { type ReceptionTask } from './reception-task.types';

/**
 * Backs the "Start" step of the mobile Reception flow — staff presses
 * Start before even picking a category, and this keeps running until
 * they either log a delivery (`completeViaReception`, called by
 * ReceptionsService.create() — not a public endpoint of its own) or
 * leave without one (`leaveUnfinished`). Pause/resume is a direct
 * mirror of FloorTasksService's pattern — see that file's doc comments
 * for the reasoning behind totalPausedMs.
 */
@Injectable()
export class ReceptionTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaReceptionTask): ReceptionTask {
    return {
      id: row.id,
      userId: row.userId,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
      totalPausedMs: row.totalPausedMs,
      outcome: row.outcome,
      receptionId: row.receptionId,
    };
  }

  async start(userId: string): Promise<ReceptionTask> {
    const existingOpen = await this.prisma.receptionTask.findFirst({ where: { userId, endedAt: null } });
    if (existingOpen) {
      throw new ConflictException({
        message: 'Already have an open reception task — finish or leave it before starting another',
        code: 'reception_task.already_open',
      });
    }
    const row = await this.prisma.receptionTask.create({
      data: { id: randomUUID(), userId, startedAt: new Date() },
    });
    return this.toDomain(row);
  }

  private async findOneRow(id: string): Promise<PrismaReceptionTask> {
    const row = await this.prisma.receptionTask.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reception task not found');
    }
    return row;
  }

  private assertOwnedAndOpen(task: PrismaReceptionTask, user: PublicUser): void {
    if (task.userId !== user.id) {
      throw new ForbiddenException({ message: 'This reception task is not yours', code: 'reception_task.not_yours' });
    }
    if (task.endedAt) {
      throw new ConflictException({ message: 'This reception task has already ended', code: 'reception_task.already_ended' });
    }
  }

  async pause(id: string, user: PublicUser): Promise<ReceptionTask> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (task.pausedAt) {
      throw new ConflictException({ message: 'This reception task is already paused', code: 'reception_task.already_paused' });
    }
    const row = await this.prisma.receptionTask.update({ where: { id }, data: { pausedAt: new Date() } });
    return this.toDomain(row);
  }

  async resume(id: string, user: PublicUser): Promise<ReceptionTask> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    if (!task.pausedAt) {
      throw new ConflictException({ message: 'This reception task is not paused', code: 'reception_task.not_paused' });
    }
    const pausedMs = Date.now() - task.pausedAt.getTime();
    const row = await this.prisma.receptionTask.update({
      where: { id },
      data: { pausedAt: null, totalPausedMs: { increment: pausedMs } },
    });
    return this.toDomain(row);
  }

  /** Staff explicitly chose "Leave Unfinished" rather than Pause — ends the task now, flagged for admin as having no confirmed delivery. */
  async leaveUnfinished(id: string, user: PublicUser): Promise<ReceptionTask> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    const stillOpenPauseMs = task.pausedAt ? Date.now() - task.pausedAt.getTime() : 0;
    const row = await this.prisma.receptionTask.update({
      where: { id },
      data: {
        endedAt: new Date(),
        outcome: 'unfinished',
        pausedAt: null,
        totalPausedMs: { increment: stillOpenPauseMs },
      },
    });
    return this.toDomain(row);
  }

  /**
   * Called by ReceptionsService.create() once a delivery is actually
   * logged — not a public HTTP endpoint of its own. Silently a no-op
   * candidate for callers that catch and ignore (see
   * ReceptionsService.create()'s doc comment on why a bad/missing id
   * there doesn't fail the whole reception).
   */
  async completeViaReception(id: string, user: PublicUser, receptionId: string): Promise<ReceptionTask> {
    const task = await this.findOneRow(id);
    this.assertOwnedAndOpen(task, user);
    const stillOpenPauseMs = task.pausedAt ? Date.now() - task.pausedAt.getTime() : 0;
    const row = await this.prisma.receptionTask.update({
      where: { id },
      data: {
        endedAt: new Date(),
        outcome: 'completed',
        receptionId,
        pausedAt: null,
        totalPausedMs: { increment: stillOpenPauseMs },
      },
    });
    return this.toDomain(row);
  }

  async findMineActive(userId: string): Promise<ReceptionTask | null> {
    const row = await this.prisma.receptionTask.findFirst({ where: { userId, endedAt: null } });
    return row ? this.toDomain(row) : null;
  }
}

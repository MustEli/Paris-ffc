import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type OrderPrepSession as PrismaSession, type OrderPrepTask as PrismaTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { type AssignOrderPrepTaskDto } from './dto/assign-order-prep-task.dto';
import { type CreateSessionDto } from './dto/create-session.dto';
import {
  PACKER_BUFFER_MINUTES,
  PACKER_PARTS_PER_HOUR,
  PICKER_PARTS_PER_HOUR,
  SHIFT_HOURS,
  type OrderPrepSession,
  type OrderPrepTask,
} from './order-prep.types';

/** Backed by Postgres via Prisma now — see users.service.ts for the pattern and why. */
@Injectable()
export class OrderPrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private toSessionDomain(row: PrismaSession): OrderPrepSession {
    return {
      id: row.id,
      totalParts: row.totalParts,
      pickersNeeded: row.pickersNeeded,
      packersNeeded: row.packersNeeded,
      packingDelayMinutes: row.packingDelayMinutes,
      pickingStartedAt: row.pickingStartedAt ? row.pickingStartedAt.toISOString() : null,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toTaskDomain(row: PrismaTask): OrderPrepTask {
    return {
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      assignedToUserId: row.assignedToUserId,
      status: row.status,
      assignedAt: row.assignedAt.toISOString(),
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      durationMs: row.durationMs,
    };
  }

  async createSession(userId: string, dto: CreateSessionDto): Promise<OrderPrepSession> {
    const pickersNeeded = Math.max(1, Math.ceil(dto.totalParts / (PICKER_PARTS_PER_HOUR * SHIFT_HOURS)));
    const packersNeeded = Math.max(1, Math.ceil(dto.totalParts / (PACKER_PARTS_PER_HOUR * SHIFT_HOURS)));

    // How long the combined picking team takes to build up enough of a
    // buffer to keep the combined packing team busy for
    // PACKER_BUFFER_MINUTES without idling — see order-prep.types.ts.
    const combinedPickerRate = pickersNeeded * PICKER_PARTS_PER_HOUR;
    const combinedPackerRate = packersNeeded * PACKER_PARTS_PER_HOUR;
    const bufferParts = combinedPackerRate * (PACKER_BUFFER_MINUTES / 60);
    const packingDelayMinutes = Math.ceil((bufferParts / combinedPickerRate) * 60);

    const row = await this.prisma.orderPrepSession.create({
      data: {
        id: randomUUID(),
        totalParts: dto.totalParts,
        pickersNeeded,
        packersNeeded,
        packingDelayMinutes,
        pickingStartedAt: null,
        createdByUserId: userId,
      },
    });
    return this.toSessionDomain(row);
  }

  async findAllSessions(): Promise<OrderPrepSession[]> {
    const rows = await this.prisma.orderPrepSession.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toSessionDomain(row));
  }

  private async findSessionRow(id: string): Promise<PrismaSession> {
    const session = await this.prisma.orderPrepSession.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException('Order prep session not found');
    }
    return session;
  }

  async findSession(id: string): Promise<OrderPrepSession> {
    return this.toSessionDomain(await this.findSessionRow(id));
  }

  async tasksForSession(sessionId: string): Promise<OrderPrepTask[]> {
    const rows = await this.prisma.orderPrepTask.findMany({ where: { sessionId } });
    return rows.map((row) => this.toTaskDomain(row));
  }

  async assignTask(sessionId: string, dto: AssignOrderPrepTaskDto): Promise<OrderPrepTask> {
    await this.findSessionRow(sessionId); // 404s if the session doesn't exist
    const assignee = await this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }

    const row = await this.prisma.orderPrepTask.create({
      data: {
        id: randomUUID(),
        sessionId,
        role: dto.role,
        assignedToUserId: dto.assignedToUserId,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
    return this.toTaskDomain(row);
  }

  private async findTaskRow(id: string): Promise<PrismaTask> {
    const task = await this.prisma.orderPrepTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Order prep task not found');
    }
    return task;
  }

  private assertAssignee(task: { assignedToUserId: string }, user: PublicUser) {
    if (task.assignedToUserId !== user.id) {
      throw new ForbiddenException('This task is not assigned to you');
    }
  }

  async findAllTasksForUser(user: PublicUser): Promise<OrderPrepTask[]> {
    const rows = await this.prisma.orderPrepTask.findMany({
      where: user.role === 'staff' ? { assignedToUserId: user.id } : undefined,
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map((row) => this.toTaskDomain(row));
  }

  async findTaskForUser(id: string, user: PublicUser): Promise<OrderPrepTask> {
    const row = await this.findTaskRow(id);
    if (user.role === 'staff') {
      this.assertAssignee(row, user);
    }
    return this.toTaskDomain(row);
  }

  async start(id: string, user: PublicUser): Promise<OrderPrepTask> {
    const task = await this.findTaskRow(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned') {
      throw new ConflictException(`Cannot start a task in status "${task.status}"`);
    }

    const session = await this.findSessionRow(task.sessionId);

    if (task.role === 'picker') {
      // First picker to start defines when the packing-delay clock begins.
      if (!session.pickingStartedAt) {
        await this.prisma.orderPrepSession.update({
          where: { id: session.id },
          data: { pickingStartedAt: new Date() },
        });
      }
    } else {
      if (!session.pickingStartedAt) {
        throw new ConflictException('Picking has not started yet for this session');
      }
      const packingStartsAt = session.pickingStartedAt.getTime() + session.packingDelayMinutes * 60_000;
      if (Date.now() < packingStartsAt) {
        throw new ConflictException(
          `Too early — packing starts at ${new Date(packingStartsAt).toISOString()} to avoid packer idle time`,
        );
      }
    }

    const row = await this.prisma.orderPrepTask.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
    return this.toTaskDomain(row);
  }

  async complete(id: string, user: PublicUser): Promise<OrderPrepTask> {
    const task = await this.findTaskRow(id);
    this.assertAssignee(task, user);
    if (task.status !== 'in_progress') {
      throw new ConflictException(`Cannot complete a task in status "${task.status}" — start it first`);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - task.startedAt!.getTime();
    const row = await this.prisma.orderPrepTask.update({
      where: { id },
      data: { status: 'completed', completedAt, durationMs },
    });
    return this.toTaskDomain(row);
  }
}

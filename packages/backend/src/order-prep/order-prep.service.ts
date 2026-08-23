import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

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

/**
 * TEMPORARY IN-MEMORY STORE — see users.service.ts for the pattern and
 * why. Resets on restart.
 */
@Injectable()
export class OrderPrepService {
  private readonly sessions: OrderPrepSession[] = [];
  private readonly tasks: OrderPrepTask[] = [];

  constructor(private readonly usersService: UsersService) {}

  createSession(userId: string, dto: CreateSessionDto): OrderPrepSession {
    const pickersNeeded = Math.max(1, Math.ceil(dto.totalParts / (PICKER_PARTS_PER_HOUR * SHIFT_HOURS)));
    const packersNeeded = Math.max(1, Math.ceil(dto.totalParts / (PACKER_PARTS_PER_HOUR * SHIFT_HOURS)));

    // How long the combined picking team takes to build up enough of a
    // buffer to keep the combined packing team busy for
    // PACKER_BUFFER_MINUTES without idling — see order-prep.types.ts.
    const combinedPickerRate = pickersNeeded * PICKER_PARTS_PER_HOUR;
    const combinedPackerRate = packersNeeded * PACKER_PARTS_PER_HOUR;
    const bufferParts = combinedPackerRate * (PACKER_BUFFER_MINUTES / 60);
    const packingDelayMinutes = Math.ceil((bufferParts / combinedPickerRate) * 60);

    const session: OrderPrepSession = {
      id: randomUUID(),
      totalParts: dto.totalParts,
      pickersNeeded,
      packersNeeded,
      packingDelayMinutes,
      pickingStartedAt: null,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(session);
    return session;
  }

  findAllSessions(): OrderPrepSession[] {
    return [...this.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findSession(id: string): OrderPrepSession {
    const session = this.sessions.find((s) => s.id === id);
    if (!session) {
      throw new NotFoundException('Order prep session not found');
    }
    return session;
  }

  tasksForSession(sessionId: string): OrderPrepTask[] {
    return this.tasks.filter((t) => t.sessionId === sessionId);
  }

  assignTask(sessionId: string, dto: AssignOrderPrepTaskDto): OrderPrepTask {
    this.findSession(sessionId); // 404s if the session doesn't exist
    const assignee = this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }

    const task: OrderPrepTask = {
      id: randomUUID(),
      sessionId,
      role: dto.role,
      assignedToUserId: dto.assignedToUserId,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      durationMs: null,
    };
    this.tasks.push(task);
    return task;
  }

  private findTask(id: string): OrderPrepTask {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      throw new NotFoundException('Order prep task not found');
    }
    return task;
  }

  private assertAssignee(task: OrderPrepTask, user: PublicUser) {
    if (task.assignedToUserId !== user.id) {
      throw new ForbiddenException('This task is not assigned to you');
    }
  }

  findAllTasksForUser(user: PublicUser): OrderPrepTask[] {
    const tasks = user.role === 'staff' ? this.tasks.filter((t) => t.assignedToUserId === user.id) : this.tasks;
    return [...tasks].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }

  findTaskForUser(id: string, user: PublicUser): OrderPrepTask {
    const task = this.findTask(id);
    if (user.role === 'staff') {
      this.assertAssignee(task, user);
    }
    return task;
  }

  start(id: string, user: PublicUser): OrderPrepTask {
    const task = this.findTask(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned') {
      throw new ConflictException(`Cannot start a task in status "${task.status}"`);
    }

    const session = this.findSession(task.sessionId);

    if (task.role === 'picker') {
      // First picker to start defines when the packing-delay clock begins.
      if (!session.pickingStartedAt) {
        session.pickingStartedAt = new Date().toISOString();
      }
    } else {
      if (!session.pickingStartedAt) {
        throw new ConflictException('Picking has not started yet for this session');
      }
      const packingStartsAt = new Date(session.pickingStartedAt).getTime() + session.packingDelayMinutes * 60_000;
      if (Date.now() < packingStartsAt) {
        throw new ConflictException(
          `Too early — packing starts at ${new Date(packingStartsAt).toISOString()} to avoid packer idle time`,
        );
      }
    }

    task.status = 'in_progress';
    task.startedAt = new Date().toISOString();
    return task;
  }

  complete(id: string, user: PublicUser): OrderPrepTask {
    const task = this.findTask(id);
    this.assertAssignee(task, user);
    if (task.status !== 'in_progress') {
      throw new ConflictException(`Cannot complete a task in status "${task.status}" — start it first`);
    }

    const completedAt = new Date();
    task.status = 'completed';
    task.completedAt = completedAt.toISOString();
    task.durationMs = completedAt.getTime() - new Date(task.startedAt!).getTime();
    return task;
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { SellerStockService } from '../seller-stock/seller-stock.service';
import { type PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { type AssignTaskDto } from './dto/assign-task.dto';
import { type ReassignTaskDto } from './dto/reassign-task.dto';
import { type PutAwayTask } from './put-away.types';

/**
 * TEMPORARY IN-MEMORY STORE — see users.service.ts for the pattern and
 * why. Resets on restart. One active task per pallet at a time — a new
 * assignment for an already-assigned pallet isn't supported (doc doesn't
 * describe concurrent tasks on one pallet); reassignment (below) is the
 * path for "this staff member can't do it, give it to someone else."
 */
@Injectable()
export class PutAwayService {
  private readonly tasks: PutAwayTask[] = [];

  constructor(
    private readonly sellerStockService: SellerStockService,
    private readonly usersService: UsersService,
  ) {}

  private findOne(id: string): PutAwayTask {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      throw new NotFoundException('Put-away task not found');
    }
    return task;
  }

  private assertAssignee(task: PutAwayTask, user: PublicUser) {
    if (task.assignedToUserId !== user.id) {
      throw new ForbiddenException('This task is not assigned to you');
    }
  }

  assign(assignedByUserId: string, dto: AssignTaskDto): PutAwayTask {
    const assignee = this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }
    if (this.tasks.some((t) => t.palletId === dto.palletId && t.status !== 'completed')) {
      throw new ConflictException('This pallet already has an active put-away task');
    }

    // Also validates the pallet is in a status eligible for assignment
    // (ready_for_putaway / pending_admin_review) and moves it to 'instructed'.
    this.sellerStockService.giveInstructions(dto.palletId, dto.location);

    const task: PutAwayTask = {
      id: randomUUID(),
      palletId: dto.palletId,
      assignedToUserId: dto.assignedToUserId,
      assignedByUserId,
      location: dto.location,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      durationMs: null,
      issueDescription: null,
    };
    this.tasks.push(task);
    return task;
  }

  findAllForUser(user: PublicUser): PutAwayTask[] {
    const tasks = user.role === 'staff' ? this.tasks.filter((t) => t.assignedToUserId === user.id) : this.tasks;
    return [...tasks].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }

  findOneForUser(id: string, user: PublicUser): PutAwayTask {
    const task = this.findOne(id);
    if (user.role === 'staff') {
      this.assertAssignee(task, user);
    }
    return task;
  }

  start(id: string, user: PublicUser): PutAwayTask {
    const task = this.findOne(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned') {
      throw new ConflictException(`Cannot start a task in status "${task.status}"`);
    }
    task.status = 'in_progress';
    task.startedAt = new Date().toISOString();
    return task;
  }

  complete(id: string, user: PublicUser): PutAwayTask {
    const task = this.findOne(id);
    this.assertAssignee(task, user);
    if (task.status !== 'in_progress') {
      throw new ConflictException(`Cannot complete a task in status "${task.status}" — start it first`);
    }

    const completedAt = new Date();
    task.status = 'completed';
    task.completedAt = completedAt.toISOString();
    task.durationMs = completedAt.getTime() - new Date(task.startedAt!).getTime();

    this.sellerStockService.putAway(task.palletId);
    return task;
  }

  reportIssue(id: string, user: PublicUser, description: string): PutAwayTask {
    const task = this.findOne(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned' && task.status !== 'in_progress') {
      throw new ConflictException(`Cannot report an issue on a task in status "${task.status}"`);
    }
    task.status = 'issue_reported';
    task.issueDescription = description;
    return task;
  }

  reassign(id: string, dto: ReassignTaskDto): PutAwayTask {
    const task = this.findOne(id);
    if (task.status !== 'issue_reported') {
      throw new ConflictException(`Cannot reassign a task in status "${task.status}" — only issue_reported tasks can be reassigned`);
    }
    const assignee = this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }

    if (dto.location) {
      this.sellerStockService.updateLocation(task.palletId, dto.location);
      task.location = dto.location;
    }
    task.assignedToUserId = dto.assignedToUserId;
    task.status = 'assigned';
    task.assignedAt = new Date().toISOString();
    task.startedAt = null;
    task.issueDescription = null;
    return task;
  }
}

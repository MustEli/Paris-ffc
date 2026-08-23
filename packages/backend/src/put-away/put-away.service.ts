import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type PutAwayTask as PrismaPutAwayTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { SellerStockService } from '../seller-stock/seller-stock.service';
import { type PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { type AssignTaskDto } from './dto/assign-task.dto';
import { type ReassignTaskDto } from './dto/reassign-task.dto';
import { type PutAwayTask } from './put-away.types';

/**
 * Backed by Postgres via Prisma now — see users.service.ts for the
 * pattern and why. One active task per pallet at a time — a new
 * assignment for an already-assigned pallet isn't supported (doc doesn't
 * describe concurrent tasks on one pallet); reassignment (below) is the
 * path for "this staff member can't do it, give it to someone else."
 */
@Injectable()
export class PutAwayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerStockService: SellerStockService,
    private readonly usersService: UsersService,
  ) {}

  private toDomain(row: PrismaPutAwayTask): PutAwayTask {
    return {
      id: row.id,
      palletId: row.palletId,
      assignedToUserId: row.assignedToUserId,
      assignedByUserId: row.assignedByUserId,
      location: row.location,
      status: row.status,
      assignedAt: row.assignedAt.toISOString(),
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      durationMs: row.durationMs,
      issueDescription: row.issueDescription,
    };
  }

  private async findOneRow(id: string): Promise<PrismaPutAwayTask> {
    const task = await this.prisma.putAwayTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException('Put-away task not found');
    }
    return task;
  }

  private assertAssignee(task: { assignedToUserId: string }, user: PublicUser) {
    if (task.assignedToUserId !== user.id) {
      throw new ForbiddenException('This task is not assigned to you');
    }
  }

  async assign(assignedByUserId: string, dto: AssignTaskDto): Promise<PutAwayTask> {
    const assignee = await this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }
    const existingActive = await this.prisma.putAwayTask.findFirst({
      where: { palletId: dto.palletId, status: { not: 'completed' } },
    });
    if (existingActive) {
      throw new ConflictException('This pallet already has an active put-away task');
    }

    // Also validates the pallet is in a status eligible for assignment
    // (ready_for_putaway / pending_admin_review) and moves it to 'instructed'.
    await this.sellerStockService.giveInstructions(dto.palletId, dto.location);

    const row = await this.prisma.putAwayTask.create({
      data: {
        id: randomUUID(),
        palletId: dto.palletId,
        assignedToUserId: dto.assignedToUserId,
        assignedByUserId,
        location: dto.location,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
    return this.toDomain(row);
  }

  async findAllForUser(user: PublicUser): Promise<PutAwayTask[]> {
    const rows = await this.prisma.putAwayTask.findMany({
      where: user.role === 'staff' ? { assignedToUserId: user.id } : undefined,
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findOneForUser(id: string, user: PublicUser): Promise<PutAwayTask> {
    const row = await this.findOneRow(id);
    if (user.role === 'staff') {
      this.assertAssignee(row, user);
    }
    return this.toDomain(row);
  }

  async start(id: string, user: PublicUser): Promise<PutAwayTask> {
    const task = await this.findOneRow(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned') {
      throw new ConflictException(`Cannot start a task in status "${task.status}"`);
    }
    const row = await this.prisma.putAwayTask.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
    return this.toDomain(row);
  }

  async complete(id: string, user: PublicUser): Promise<PutAwayTask> {
    const task = await this.findOneRow(id);
    this.assertAssignee(task, user);
    if (task.status !== 'in_progress') {
      throw new ConflictException(`Cannot complete a task in status "${task.status}" — start it first`);
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - task.startedAt!.getTime();
    const row = await this.prisma.putAwayTask.update({
      where: { id },
      data: { status: 'completed', completedAt, durationMs },
    });

    await this.sellerStockService.putAway(task.palletId);
    return this.toDomain(row);
  }

  async reportIssue(id: string, user: PublicUser, description: string): Promise<PutAwayTask> {
    const task = await this.findOneRow(id);
    this.assertAssignee(task, user);
    if (task.status !== 'assigned' && task.status !== 'in_progress') {
      throw new ConflictException(`Cannot report an issue on a task in status "${task.status}"`);
    }
    const row = await this.prisma.putAwayTask.update({
      where: { id },
      data: { status: 'issue_reported', issueDescription: description },
    });
    return this.toDomain(row);
  }

  async reassign(id: string, dto: ReassignTaskDto): Promise<PutAwayTask> {
    const task = await this.findOneRow(id);
    if (task.status !== 'issue_reported') {
      throw new ConflictException(`Cannot reassign a task in status "${task.status}" — only issue_reported tasks can be reassigned`);
    }
    const assignee = await this.usersService.findById(dto.assignedToUserId);
    if (!assignee || assignee.role !== 'staff') {
      throw new BadRequestException('assignedToUserId must reference an existing staff user');
    }

    if (dto.location) {
      await this.sellerStockService.updateLocation(task.palletId, dto.location);
    }

    const row = await this.prisma.putAwayTask.update({
      where: { id },
      data: {
        location: dto.location ?? task.location,
        assignedToUserId: dto.assignedToUserId,
        status: 'assigned',
        assignedAt: new Date(),
        startedAt: null,
        issueDescription: null,
      },
    });
    return this.toDomain(row);
  }
}

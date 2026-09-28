import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type OpenPoolTask as PrismaOpenPoolTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { type PublicUser } from '../users/user.types';
import { type CreateOpenPoolTaskDto } from './dto/create-open-pool-task.dto';
import { type OpenPoolTask } from './open-pool.types';

/**
 * Open Pool Tasks doc — see schema.prisma's OpenPoolTask doc comment for
 * why this is a separate model. claim() is the one piece that actually
 * matters here: an atomic conditional update (updateMany with a status
 * filter, not read-then-write) so two staff tapping "claim" on the same
 * task at nearly the same instant can't both succeed — whoever's update
 * actually matches a row wins, the other gets 0 rows affected and a
 * clear rejection, exactly the "optimistic locking" the doc asks for.
 */
@Injectable()
export class OpenPoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private toDomain(row: PrismaOpenPoolTask): OpenPoolTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      createdByUserId: row.createdByUserId,
      claimedByUserId: row.claimedByUserId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }

  async create(adminId: string, dto: CreateOpenPoolTaskDto): Promise<OpenPoolTask> {
    const row = await this.prisma.openPoolTask.create({
      data: {
        id: randomUUID(),
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'normal',
        createdByUserId: adminId,
        status: 'open',
      },
    });
    // Every connected staff device removes/adds this from its open-pool
    // list live — see the doc's "instantly remove from all other staff
    // handhelds" requirement (for claims) and its mirror for creation.
    this.realtimeService.emitToRole('staff', 'openpool:created', this.toDomain(row));
    return this.toDomain(row);
  }

  async findOpen(): Promise<OpenPoolTask[]> {
    const rows = await this.prisma.openPoolTask.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findMine(userId: string): Promise<OpenPoolTask[]> {
    const rows = await this.prisma.openPoolTask.findMany({
      where: { claimedByUserId: userId, status: 'claimed' },
      orderBy: { claimedAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findAll(): Promise<OpenPoolTask[]> {
    const rows = await this.prisma.openPoolTask.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async claim(id: string, userId: string): Promise<OpenPoolTask> {
    const result = await this.prisma.openPoolTask.updateMany({
      where: { id, status: 'open' },
      data: { status: 'claimed', claimedByUserId: userId, claimedAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.openPoolTask.findUnique({ where: { id } });
      if (!exists) {
        throw new NotFoundException('Open pool task not found');
      }
      throw new ConflictException('Task already claimed by another staff member');
    }

    const row = await this.prisma.openPoolTask.findUniqueOrThrow({ where: { id } });
    // Live-remove from every other staff device's list the instant it's claimed.
    this.realtimeService.emitToRole('staff', 'openpool:claimed', { id });
    return this.toDomain(row);
  }

  async complete(id: string, user: PublicUser): Promise<OpenPoolTask> {
    const row = await this.prisma.openPoolTask.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Open pool task not found');
    }
    if (row.claimedByUserId !== user.id) {
      throw new ForbiddenException('This task is not claimed by you');
    }
    if (row.status !== 'claimed') {
      throw new ConflictException(`Cannot complete a task in status "${row.status}"`);
    }
    const updated = await this.prisma.openPoolTask.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
    this.realtimeService.emitToRole('admin', 'openpool:completed', { id });
    return this.toDomain(updated);
  }
}

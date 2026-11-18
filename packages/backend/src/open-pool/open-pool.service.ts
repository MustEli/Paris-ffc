import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type OpenPoolTask as PrismaOpenPoolTask } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { FloorTasksService } from '../floor-tasks/floor-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { type Reception } from '../receptions/reception.types';
import { ReceptionsService } from '../receptions/receptions.service';
import { SellerStockService } from '../seller-stock/seller-stock.service';
import { type SellerStockPallet } from '../seller-stock/seller-stock.types';
import { type PublicUser } from '../users/user.types';
import { type CompleteOpenPoolTaskDto } from './dto/complete-open-pool-task.dto';
import { type CreateOpenPoolTaskDto } from './dto/create-open-pool-task.dto';
import { type DispatchTaskItemDto } from './dto/dispatch-tasks.dto';
import { type DispatchItemResult, type OpenPoolTask } from './open-pool.types';

function receptionTaskTitle(reception: Reception): string {
  switch (reception.details.category) {
    case 'return_parcels':
      return `Put away: ${reception.details.parcelCount} parcel(s) from ${reception.details.transporterCompany}`;
    case 'packaging_stock':
      return `Put away: ${reception.details.parcelCount} parcel(s) — ${reception.details.packagingType}`;
    case 'equipment_other':
      return `Put away: ${reception.details.itemDescription}`;
    case 'sellers_stock':
      return `Put away: ${reception.details.palletCount} pallet(s)`;
  }
}

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
  private readonly logger = new Logger(OpenPoolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly floorTasksService: FloorTasksService,
    private readonly receptionsService: ReceptionsService,
    private readonly sellerStockService: SellerStockService,
  ) {}

  private toDomain(row: PrismaOpenPoolTask): OpenPoolTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      createdByUserId: row.createdByUserId,
      targetUserId: row.targetUserId,
      claimedByUserId: row.claimedByUserId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      creationPhotoUrl: row.creationPhotoUrl,
      creationComment: row.creationComment,
      completionPhotoUrl: row.completionPhotoUrl,
      completionComment: row.completionComment,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
    };
  }

  /** Emits to the targeted user's own room if set, otherwise broadcasts to every staff device — same split Directives uses. */
  private emitCreated(task: OpenPoolTask): void {
    if (task.targetUserId) {
      this.realtimeService.emitToUser(task.targetUserId, 'openpool:created', task);
    } else {
      this.realtimeService.emitToRole('staff', 'openpool:created', task);
    }
  }

  async create(adminId: string, dto: CreateOpenPoolTaskDto): Promise<OpenPoolTask> {
    const row = await this.prisma.openPoolTask.create({
      data: {
        id: randomUUID(),
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'normal',
        createdByUserId: adminId,
        targetUserId: dto.targetUserId ?? null,
        status: 'open',
        creationPhotoUrl: dto.creationPhotoUrl ?? null,
        creationComment: dto.creationComment ?? null,
      },
    });
    const task = this.toDomain(row);
    // Every connected staff device removes/adds this from its open-pool
    // list live — see the doc's "instantly remove from all other staff
    // handhelds" requirement (for claims) and its mirror for creation.
    this.emitCreated(task);
    return task;
  }

  async findOpen(userId: string): Promise<OpenPoolTask[]> {
    const rows = await this.prisma.openPoolTask.findMany({
      where: { status: 'open', OR: [{ targetUserId: null }, { targetUserId: userId }] },
      orderBy: { createdAt: 'asc' },
    });
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
    const existing = await this.prisma.openPoolTask.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Open pool task not found');
    }
    if (existing.targetUserId && existing.targetUserId !== userId) {
      throw new ForbiddenException('This task is not targeted at you');
    }

    const result = await this.prisma.openPoolTask.updateMany({
      where: { id, status: 'open' },
      data: { status: 'claimed', claimedByUserId: userId, claimedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException({
        message: 'Task already claimed by another staff member',
        code: 'open_pool.already_claimed',
      });
    }

    // Claiming a pool task means dropping whatever floor task was
    // running — never leave both "in progress" at once.
    await this.floorTasksService.pauseIfRunning(userId);

    const row = await this.prisma.openPoolTask.findUniqueOrThrow({ where: { id } });
    // Live-remove from every other staff device's list the instant it's claimed.
    this.realtimeService.emitToRole('staff', 'openpool:claimed', { id });
    return this.toDomain(row);
  }

  async complete(id: string, user: PublicUser, dto: CompleteOpenPoolTaskDto): Promise<OpenPoolTask> {
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
      data: {
        status: 'completed',
        completedAt: new Date(),
        completionPhotoUrl: dto.completionPhotoUrl,
        completionComment: dto.completionComment,
      },
    });

    // Dispatched-from-a-Reception tasks are the real replacement for
    // the old admin-instructions step for that reception — completing
    // the task completes the reception too. Best-effort: a failure here
    // (e.g. the reception was already completed some other way) never
    // fails the task completion staff is actually performing.
    if (updated.sourceType === 'reception' && updated.sourceId) {
      try {
        await this.receptionsService.complete(updated.sourceId);
      } catch (err) {
        this.logger.warn(`Failed to complete source reception ${updated.sourceId} for open pool task ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.realtimeService.emitToRole('admin', 'openpool:completed', { id });
    return this.toDomain(updated);
  }

  private async resolveTaskTitle(
    item: { sourceType: 'reception'; reception: Reception } | { sourceType: 'seller_stock_pallet'; pallet: SellerStockPallet },
  ): Promise<string> {
    return item.sourceType === 'reception' ? receptionTaskTitle(item.reception) : `Pallet ${item.pallet.palletIndex} — ${item.pallet.sellerName}`;
  }

  /**
   * Backs the web dashboard's "Pending Instructions" bulk-dispatch flow
   * — each selected reception becomes its own Open Pool task, and
   * dispatching it IS giving it admin instructions (addInstructions
   * moves it out of "arrived"), same as the existing single/bulk
   * instructions flow. One bad row never aborts the rest of the batch.
   */
  async dispatchFromReceptions(adminId: string, items: DispatchTaskItemDto[], targetUserId: string | undefined): Promise<DispatchItemResult[]> {
    const results: DispatchItemResult[] = [];
    for (const item of items) {
      try {
        const reception = await this.receptionsService.findOne(item.id);
        await this.receptionsService.addInstructions(item.id, item.comment);
        const title = await this.resolveTaskTitle({ sourceType: 'reception', reception });
        const row = await this.prisma.openPoolTask.create({
          data: {
            id: randomUUID(),
            title,
            priority: 'normal',
            createdByUserId: adminId,
            targetUserId: targetUserId ?? null,
            status: 'open',
            creationComment: item.comment,
            sourceType: 'reception',
            sourceId: item.id,
          },
        });
        this.emitCreated(this.toDomain(row));
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({ id: item.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return results;
  }

  /**
   * Backs the web dashboard's "Seller Stock Photos" bulk-dispatch flow —
   * purely informational (doesn't touch the pallet's own status), the
   * task carries the pallet's first photo automatically as reference.
   */
  async dispatchFromPallets(adminId: string, items: DispatchTaskItemDto[], targetUserId: string | undefined): Promise<DispatchItemResult[]> {
    const results: DispatchItemResult[] = [];
    for (const item of items) {
      try {
        const pallet = await this.sellerStockService.findOne(item.id);
        const title = await this.resolveTaskTitle({ sourceType: 'seller_stock_pallet', pallet });
        const row = await this.prisma.openPoolTask.create({
          data: {
            id: randomUUID(),
            title,
            priority: 'normal',
            createdByUserId: adminId,
            targetUserId: targetUserId ?? null,
            status: 'open',
            creationComment: item.comment,
            creationPhotoUrl: pallet.labelPhotoUrls[0] ?? null,
            sourceType: 'seller_stock_pallet',
            sourceId: item.id,
          },
        });
        this.emitCreated(this.toDomain(row));
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({ id: item.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return results;
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Directive as PrismaDirective } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { FloorTasksService } from '../floor-tasks/floor-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';
import { type CreateDirectiveDto } from './dto/create-directive.dto';
import { type Directive } from './directive.types';

/**
 * Admin to Staff doc — see schema.prisma's Directive doc comment for
 * what this does and deliberately doesn't do (no hard pause of the
 * target's current activity). acknowledge() uses the same atomic
 * conditional-update pattern as OpenPoolTask.claim() for the "anyone
 * available" case — first staff member to acknowledge wins.
 */
@Injectable()
export class DirectivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly realtimeService: RealtimeService,
    private readonly floorTasksService: FloorTasksService,
  ) {}

  private toDomain(row: PrismaDirective): Directive {
    return {
      id: row.id,
      targetUserId: row.targetUserId,
      issuerUserId: row.issuerUserId,
      type: row.type,
      message: row.message,
      status: row.status,
      receivedByUserId: row.receivedByUserId,
      pushedAt: row.pushedAt.toISOString(),
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      creationPhotoUrl: row.creationPhotoUrl,
      creationComment: row.creationComment,
      completionPhotoUrl: row.completionPhotoUrl,
      completionComment: row.completionComment,
    };
  }

  async create(issuerId: string, dto: CreateDirectiveDto): Promise<Directive> {
    if (dto.targetUserId) {
      const target = await this.usersService.findById(dto.targetUserId);
      if (!target || target.role !== 'staff') {
        throw new BadRequestException('targetUserId must reference an existing staff user');
      }
    }

    const row = await this.prisma.directive.create({
      data: {
        id: randomUUID(),
        targetUserId: dto.targetUserId ?? null,
        issuerUserId: issuerId,
        type: dto.type,
        message: dto.message,
        status: 'pushed',
        creationPhotoUrl: dto.creationPhotoUrl ?? null,
        creationComment: dto.creationComment ?? null,
      },
    });
    const directive = this.toDomain(row);

    // Audible, real-time push — the doc's "loud, distinct audio ping."
    if (dto.targetUserId) {
      this.realtimeService.emitToUser(dto.targetUserId, 'directive:pushed', directive);
    } else {
      this.realtimeService.emitToRole('staff', 'directive:pushed', directive);
    }
    return directive;
  }

  private async findOneRow(id: string): Promise<PrismaDirective> {
    const row = await this.prisma.directive.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Directive not found');
    }
    return row;
  }

  async acknowledge(id: string, userId: string): Promise<Directive> {
    const directive = await this.findOneRow(id);
    if (directive.targetUserId && directive.targetUserId !== userId) {
      throw new ForbiddenException('This directive is not targeted at you');
    }

    const result = await this.prisma.directive.updateMany({
      where: { id, status: 'pushed' },
      data: { status: 'in_progress', receivedByUserId: userId, receivedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('Already acknowledged by another staff member');
    }

    // Accepting a directive means dropping whatever floor task was
    // running — never leave both "in progress" at once.
    await this.floorTasksService.pauseIfRunning(userId);

    const row = await this.prisma.directive.findUniqueOrThrow({ where: { id } });
    const acknowledged = this.toDomain(row);
    this.realtimeService.emitToRole('admin', 'directive:acknowledged', acknowledged);
    // "Anyone available" directives need every OTHER staff device to drop
    // it from their screen the instant someone else takes it — same
    // live-removal requirement as OpenPoolTask.claim().
    if (!directive.targetUserId) {
      this.realtimeService.emitToRole('staff', 'directive:acknowledged', acknowledged);
    }
    return acknowledged;
  }

  async resolve(id: string, userId: string, completionPhotoUrl: string, completionComment: string): Promise<Directive> {
    const directive = await this.findOneRow(id);
    if (directive.receivedByUserId !== userId) {
      throw new ForbiddenException('This directive was not acknowledged by you');
    }
    if (directive.status !== 'in_progress') {
      throw new ConflictException(`Cannot resolve a directive in status "${directive.status}"`);
    }

    const row = await this.prisma.directive.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date(), completionPhotoUrl, completionComment },
    });
    this.realtimeService.emitToRole('admin', 'directive:resolved', this.toDomain(row));
    return this.toDomain(row);
  }

  /** Staff's own view: targeted at me, still-open "anyone available" ones, or ones I've already acknowledged. */
  async findMineActive(userId: string): Promise<Directive[]> {
    const rows = await this.prisma.directive.findMany({
      where: {
        status: { not: 'resolved' },
        OR: [{ targetUserId: userId }, { targetUserId: null, status: 'pushed' }, { receivedByUserId: userId }],
      },
      orderBy: { pushedAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findAll(): Promise<Directive[]> {
    const rows = await this.prisma.directive.findMany({ orderBy: { pushedAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }
}

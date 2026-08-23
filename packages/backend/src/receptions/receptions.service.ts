import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Reception as PrismaReception } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type CreateReceptionDto } from './dto/create-reception.dto';
import { type Reception, type ReceptionDetails } from './reception.types';

const REVIEW_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours — doc Step 5

/**
 * Backed by Postgres via Prisma now — see users.service.ts for the
 * pattern and why. ReceptionDetails' discriminated union is flattened
 * into nullable columns on the Reception model (see schema.prisma) —
 * buildDetailsColumns()/toDomain() convert between the two shapes.
 */
@Injectable()
export class ReceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDetails(dto: CreateReceptionDto): ReceptionDetails {
    switch (dto.category) {
      case 'return_parcels':
        if (!dto.parcelCount || !dto.transporterCompany) {
          throw new BadRequestException('return_parcels requires parcelCount and transporterCompany');
        }
        return { category: 'return_parcels', parcelCount: dto.parcelCount, transporterCompany: dto.transporterCompany };

      case 'packaging_stock':
        if (!dto.parcelCount || !dto.packagingType) {
          throw new BadRequestException('packaging_stock requires parcelCount and packagingType');
        }
        return { category: 'packaging_stock', parcelCount: dto.parcelCount, packagingType: dto.packagingType };

      case 'sellers_stock':
        if (!dto.palletCount) {
          throw new BadRequestException('sellers_stock requires palletCount');
        }
        return { category: 'sellers_stock', palletCount: dto.palletCount };

      case 'equipment_other':
        if (!dto.parcelCount || !dto.itemDescription) {
          throw new BadRequestException('equipment_other requires parcelCount and itemDescription');
        }
        return { category: 'equipment_other', parcelCount: dto.parcelCount, itemDescription: dto.itemDescription };
    }
  }

  /** The inverse of toDomain's details reconstruction — only the columns matching `category` are populated. */
  private buildDetailsColumns(details: ReceptionDetails) {
    switch (details.category) {
      case 'return_parcels':
        return {
          parcelCount: details.parcelCount,
          transporterCompany: details.transporterCompany,
          packagingType: null,
          palletCount: null,
          itemDescription: null,
        };
      case 'packaging_stock':
        return {
          parcelCount: details.parcelCount,
          packagingType: details.packagingType,
          transporterCompany: null,
          palletCount: null,
          itemDescription: null,
        };
      case 'sellers_stock':
        return {
          palletCount: details.palletCount,
          parcelCount: null,
          transporterCompany: null,
          packagingType: null,
          itemDescription: null,
        };
      case 'equipment_other':
        return {
          parcelCount: details.parcelCount,
          itemDescription: details.itemDescription,
          transporterCompany: null,
          packagingType: null,
          palletCount: null,
        };
    }
  }

  private toDomain(row: PrismaReception): Reception {
    let details: ReceptionDetails;
    switch (row.category) {
      case 'return_parcels':
        details = { category: 'return_parcels', parcelCount: row.parcelCount!, transporterCompany: row.transporterCompany! };
        break;
      case 'packaging_stock':
        details = { category: 'packaging_stock', parcelCount: row.parcelCount!, packagingType: row.packagingType! };
        break;
      case 'sellers_stock':
        details = { category: 'sellers_stock', palletCount: row.palletCount! };
        break;
      case 'equipment_other':
        details = { category: 'equipment_other', parcelCount: row.parcelCount!, itemDescription: row.itemDescription! };
        break;
    }
    return {
      id: row.id,
      createdByUserId: row.createdByUserId,
      status: row.status,
      details,
      arrivedAt: row.arrivedAt.toISOString(),
      instructions: row.instructions,
      putAwayAt: row.putAwayAt ? row.putAwayAt.toISOString() : null,
      processingDurationMs: row.processingDurationMs,
      flaggedForReview: row.flaggedForReview,
    };
  }

  async create(userId: string, dto: CreateReceptionDto): Promise<Reception> {
    const details = this.buildDetails(dto);
    const row = await this.prisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: userId,
        status: 'arrived',
        category: details.category,
        arrivedAt: new Date(),
        ...this.buildDetailsColumns(details),
      },
    });
    return this.toDomain(row);
  }

  async findAll(): Promise<Reception[]> {
    // Newest first — matches "real-time log" from the Admin user story.
    const rows = await this.prisma.reception.findMany({ orderBy: { arrivedAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }

  private async findOneRow(id: string): Promise<PrismaReception> {
    const row = await this.prisma.reception.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Reception not found');
    }
    return row;
  }

  async findOne(id: string): Promise<Reception> {
    return this.toDomain(await this.findOneRow(id));
  }

  async addInstructions(id: string, instructions: string): Promise<Reception> {
    const reception = await this.findOneRow(id);
    if (reception.status !== 'arrived') {
      throw new ConflictException(`Cannot give instructions for a reception in status "${reception.status}"`);
    }
    const row = await this.prisma.reception.update({
      where: { id },
      data: { instructions, status: 'ready_for_putaway' },
    });
    return this.toDomain(row);
  }

  async complete(id: string): Promise<Reception> {
    const reception = await this.findOneRow(id);
    if (reception.status !== 'ready_for_putaway') {
      throw new ConflictException(
        `Cannot complete a reception in status "${reception.status}" — admin instructions are required first`,
      );
    }

    const putAwayAt = new Date();
    const durationMs = putAwayAt.getTime() - reception.arrivedAt.getTime();

    const row = await this.prisma.reception.update({
      where: { id },
      data: {
        putAwayAt,
        processingDurationMs: durationMs,
        status: 'completed',
        flaggedForReview: durationMs > REVIEW_THRESHOLD_MS,
      },
    });
    return this.toDomain(row);
  }
}

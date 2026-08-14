import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { type CreateReceptionDto } from './dto/create-reception.dto';
import { type Reception, type ReceptionDetails } from './reception.types';

const REVIEW_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours — doc Step 5

/**
 * TEMPORARY IN-MEMORY STORE — see users.service.ts for the pattern and
 * why. Resets on restart.
 */
@Injectable()
export class ReceptionsService {
  private readonly receptions: Reception[] = [];

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

  create(userId: string, dto: CreateReceptionDto): Reception {
    const reception: Reception = {
      id: randomUUID(),
      createdByUserId: userId,
      status: 'arrived',
      details: this.buildDetails(dto),
      arrivedAt: new Date().toISOString(),
      instructions: null,
      putAwayAt: null,
      processingDurationMs: null,
      flaggedForReview: false,
    };
    this.receptions.push(reception);
    return reception;
  }

  findAll(): Reception[] {
    // Newest first — matches "real-time log" from the Admin user story.
    return [...this.receptions].sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
  }

  findOne(id: string): Reception {
    const reception = this.receptions.find((r) => r.id === id);
    if (!reception) {
      throw new NotFoundException('Reception not found');
    }
    return reception;
  }

  addInstructions(id: string, instructions: string): Reception {
    const reception = this.findOne(id);
    if (reception.status !== 'arrived') {
      throw new ConflictException(`Cannot give instructions for a reception in status "${reception.status}"`);
    }
    reception.instructions = instructions;
    reception.status = 'ready_for_putaway';
    return reception;
  }

  complete(id: string): Reception {
    const reception = this.findOne(id);
    if (reception.status !== 'ready_for_putaway') {
      throw new ConflictException(
        `Cannot complete a reception in status "${reception.status}" — admin instructions are required first`,
      );
    }

    const putAwayAt = new Date();
    const durationMs = putAwayAt.getTime() - new Date(reception.arrivedAt).getTime();

    reception.putAwayAt = putAwayAt.toISOString();
    reception.processingDurationMs = durationMs;
    reception.status = 'completed';
    reception.flaggedForReview = durationMs > REVIEW_THRESHOLD_MS;

    return reception;
  }
}

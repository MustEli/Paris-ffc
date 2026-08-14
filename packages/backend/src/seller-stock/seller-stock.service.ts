import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { type CreatePalletDto } from './dto/create-pallet.dto';
import { OVERWEIGHT_THRESHOLD_KG, type SellerStockPallet } from './seller-stock.types';

/**
 * TEMPORARY IN-MEMORY STORE — see users.service.ts for the pattern and
 * why. Resets on restart.
 */
@Injectable()
export class SellerStockService {
  private readonly pallets: SellerStockPallet[] = [];
  private palletCounter = 0;

  private nextPalletIndex(): string {
    this.palletCounter += 1;
    return `PLT-${String(this.palletCounter).padStart(6, '0')}`;
  }

  create(userId: string, dto: CreatePalletDto): SellerStockPallet {
    if (dto.condition === 'damaged' && (!dto.damageRemarks || !dto.damageEvidencePhotoUrls?.length)) {
      throw new BadRequestException(
        'Damaged pallets require damageRemarks and at least one damageEvidencePhotoUrls entry',
      );
    }

    const overweightFlag = dto.weightKg > OVERWEIGHT_THRESHOLD_KG;
    const needsReview = dto.condition === 'damaged' || overweightFlag;

    const pallet: SellerStockPallet = {
      id: randomUUID(),
      palletIndex: this.nextPalletIndex(),
      boxNumber: dto.boxNumber,
      sellerName: dto.sellerName,
      weightKg: dto.weightKg,
      overweightFlag,
      condition: dto.condition,
      damageRemarks: dto.damageRemarks ?? null,
      damageEvidencePhotoUrls: dto.damageEvidencePhotoUrls ?? [],
      labelPhotoUrl: dto.labelPhotoUrl,
      status: needsReview ? 'pending_admin_review' : 'ready_for_putaway',
      putAwayLocation: null,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
      putAwayAt: null,
    };
    this.pallets.push(pallet);
    return pallet;
  }

  findAll(): SellerStockPallet[] {
    return [...this.pallets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findOne(id: string): SellerStockPallet {
    const pallet = this.pallets.find((p) => p.id === id);
    if (!pallet) {
      throw new NotFoundException('Pallet not found');
    }
    return pallet;
  }

  giveInstructions(id: string, location: string): SellerStockPallet {
    const pallet = this.findOne(id);
    if (pallet.status !== 'ready_for_putaway' && pallet.status !== 'pending_admin_review') {
      throw new ConflictException(`Cannot give instructions for a pallet in status "${pallet.status}"`);
    }
    pallet.putAwayLocation = location;
    pallet.status = 'instructed';
    return pallet;
  }

  putAway(id: string): SellerStockPallet {
    const pallet = this.findOne(id);
    if (pallet.status !== 'instructed') {
      throw new ConflictException(
        `Cannot put away a pallet in status "${pallet.status}" — admin instructions are required first`,
      );
    }
    pallet.status = 'put_away';
    pallet.putAwayAt = new Date().toISOString();
    return pallet;
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type SellerStockPallet as PrismaPallet } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { type CreatePalletDto } from './dto/create-pallet.dto';
import {
  DELIVERY_PROOF_PHOTOS_MAX,
  DELIVERY_PROOF_PHOTOS_MIN,
  MAX_PHOTOS_PER_FIELD,
  OVERWEIGHT_THRESHOLD_KG,
  type SellerStockPallet,
} from './seller-stock.types';

/**
 * Backed by Postgres via Prisma now — see users.service.ts for the
 * pattern and why. The human-readable palletIndex ("PLT-000001") used
 * to come from a service-level counter; now it's derived from the
 * model's `seq` autoincrement column (a real DB sequence) at read time.
 */
@Injectable()
export class SellerStockService {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaPallet): SellerStockPallet {
    return {
      id: row.id,
      palletIndex: `PLT-${String(row.seq).padStart(6, '0')}`,
      boxNumber: row.boxNumber,
      sellerName: row.sellerName,
      weightKg: row.weightKg,
      overweightFlag: row.overweightFlag,
      condition: row.condition,
      conditionFlags: row.conditionFlags,
      damageRemarks: row.damageRemarks,
      damageEvidencePhotoUrls: row.damageEvidencePhotoUrls,
      labelPhotoUrls: row.labelPhotoUrls,
      status: row.status,
      putAwayLocation: row.putAwayLocation,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      putAwayAt: row.putAwayAt ? row.putAwayAt.toISOString() : null,
    };
  }

  async create(userId: string, dto: CreatePalletDto): Promise<SellerStockPallet> {
    // Exactly ['good'] is the only combination that skips review — any
    // other flag present (even alongside 'good') routes to Admin, same
    // as the old single-value 'damaged' condition did.
    const isGoodOnly = dto.conditionFlags.length === 1 && dto.conditionFlags[0] === 'good';
    const condition: 'good' | 'damaged' = isGoodOnly ? 'good' : 'damaged';

    if (!isGoodOnly && (!dto.damageRemarks || !dto.damageEvidencePhotoUrls?.length)) {
      throw new BadRequestException(
        'A pallet flagged as anything other than Good Condition requires damageRemarks and at least one damageEvidencePhotoUrls entry',
      );
    }
    if (dto.labelPhotoUrls.length < DELIVERY_PROOF_PHOTOS_MIN || dto.labelPhotoUrls.length > DELIVERY_PROOF_PHOTOS_MAX) {
      throw new BadRequestException(
        `labelPhotoUrls (Delivery Proof) requires between ${DELIVERY_PROOF_PHOTOS_MIN} and ${DELIVERY_PROOF_PHOTOS_MAX} photos`,
      );
    }
    if ((dto.damageEvidencePhotoUrls?.length ?? 0) > MAX_PHOTOS_PER_FIELD) {
      throw new BadRequestException(`damageEvidencePhotoUrls cannot exceed ${MAX_PHOTOS_PER_FIELD} photos`);
    }

    const overweightFlag = dto.weightKg > OVERWEIGHT_THRESHOLD_KG;
    const needsReview = !isGoodOnly || overweightFlag;

    const row = await this.prisma.sellerStockPallet.create({
      data: {
        id: randomUUID(),
        boxNumber: dto.boxNumber,
        sellerName: dto.sellerName,
        weightKg: dto.weightKg,
        overweightFlag,
        condition,
        conditionFlags: dto.conditionFlags,
        damageRemarks: dto.damageRemarks ?? null,
        damageEvidencePhotoUrls: dto.damageEvidencePhotoUrls ?? [],
        labelPhotoUrls: dto.labelPhotoUrls,
        status: needsReview ? 'pending_admin_review' : 'ready_for_putaway',
        putAwayLocation: null,
        createdByUserId: userId,
        putAwayAt: null,
      },
    });
    return this.toDomain(row);
  }

  async findAll(): Promise<SellerStockPallet[]> {
    const rows = await this.prisma.sellerStockPallet.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.toDomain(row));
  }

  private async findOneRow(id: string): Promise<PrismaPallet> {
    const row = await this.prisma.sellerStockPallet.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Pallet not found');
    }
    return row;
  }

  async findOne(id: string): Promise<SellerStockPallet> {
    return this.toDomain(await this.findOneRow(id));
  }

  async giveInstructions(id: string, location: string): Promise<SellerStockPallet> {
    const pallet = await this.findOneRow(id);
    if (pallet.status !== 'ready_for_putaway' && pallet.status !== 'pending_admin_review') {
      throw new ConflictException(`Cannot give instructions for a pallet in status "${pallet.status}"`);
    }
    const row = await this.prisma.sellerStockPallet.update({
      where: { id },
      data: { putAwayLocation: location, status: 'instructed' },
    });
    return this.toDomain(row);
  }

  async putAway(id: string): Promise<SellerStockPallet> {
    const pallet = await this.findOneRow(id);
    if (pallet.status !== 'instructed') {
      throw new ConflictException(
        `Cannot put away a pallet in status "${pallet.status}" — admin instructions are required first`,
      );
    }
    const row = await this.prisma.sellerStockPallet.update({
      where: { id },
      data: { status: 'put_away', putAwayAt: new Date() },
    });
    return this.toDomain(row);
  }

  /**
   * Staff View / Integration docs: a pallet that reached
   * 'ready_for_putaway' (Good Condition only, not overweight — see
   * create()'s needsReview) never needed Admin's review to get there, so
   * it doesn't need Admin's instruction to get put away either — staff
   * picks their own target zone and confirms directly. Deliberately a
   * separate, simpler path from PutAwayService's assign→start→complete
   * flow (which stays exactly as-is for anything that DID need review):
   * no PutAwayTask row, no per-staff task tracking, since Admin isn't
   * meant to act on or monitor this path at all — just see the
   * aggregate counts (Reports/Admin dashboard already do that).
   */
  async selfPutAway(id: string, zone: string): Promise<SellerStockPallet> {
    const pallet = await this.findOneRow(id);
    if (pallet.status !== 'ready_for_putaway') {
      throw new ConflictException({
        message: `Cannot self-confirm put-away for a pallet in status "${pallet.status}" — only a pallet that skipped admin review (Good Condition, not overweight) qualifies`,
        code: 'seller_stock.not_ready_for_self_putaway',
      });
    }
    const row = await this.prisma.sellerStockPallet.update({
      where: { id },
      data: { status: 'put_away', putAwayLocation: zone, putAwayAt: new Date() },
    });
    return this.toDomain(row);
  }

  /**
   * Used by PutAwayService when reassigning a task with a new location —
   * the pallet is already 'instructed' at that point (unchanged status
   * throughout a task's lifecycle), so this just updates the field
   * without giveInstructions()'s status guard.
   */
  async updateLocation(id: string, location: string): Promise<SellerStockPallet> {
    await this.findOneRow(id);
    const row = await this.prisma.sellerStockPallet.update({ where: { id }, data: { putAwayLocation: location } });
    return this.toDomain(row);
  }
}

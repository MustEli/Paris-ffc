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
 * pattern and why. The human-readable palletIndex used to be a
 * sequential counter-based code ("PLT-000001"); the customer asked for
 * "{sellerName}-{boxNumber}" instead (e.g. "Fandaki polo-12") since
 * that's what's actually meaningful to them. Since that's built from
 * free-text fields rather than a guaranteed-unique sequence, two
 * pallets from the same seller reusing the same box number would
 * otherwise render identically — disambiguated below by appending the
 * pallet's own `seq` (the old counter column, kept in the schema and
 * reused here rather than inventing a new one) whenever a collision
 * exists ANYWHERE in the table, not just within whatever subset of
 * rows a given call happens to return. Deliberately exact-match
 * (case-sensitive), not case-insensitive — the two collision-detection
 * paths below (single-row vs. list) need to agree with each other, and
 * case-insensitive matching is only straightforward for one of them
 * (the list path's groupBy can't express LOWER() without raw SQL), so
 * consistency between the two wins over the nice-to-have.
 */
@Injectable()
export class SellerStockService {
  constructor(private readonly prisma: PrismaService) {}

  private palletIndexFor(row: Pick<PrismaPallet, 'sellerName' | 'boxNumber' | 'seq'>, isAmbiguous: boolean): string {
    const base = `${row.sellerName}-${row.boxNumber}`;
    return isAmbiguous ? `${base} (#${row.seq})` : base;
  }

  private rowToDomain(row: PrismaPallet, isAmbiguous: boolean): SellerStockPallet {
    return {
      id: row.id,
      palletIndex: this.palletIndexFor(row, isAmbiguous),
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

  /** Single-row path — one targeted count query against the rest of the table. */
  private async toDomain(row: PrismaPallet): Promise<SellerStockPallet> {
    const collidingCount = await this.prisma.sellerStockPallet.count({
      where: { sellerName: row.sellerName, boxNumber: row.boxNumber, id: { not: row.id } },
    });
    return this.rowToDomain(row, collidingCount > 0);
  }

  /** List path — one groupBy for the whole table instead of a count-per-row (would be N+1). */
  private async toDomainList(rows: PrismaPallet[]): Promise<SellerStockPallet[]> {
    if (rows.length === 0) return [];
    const groups = await this.prisma.sellerStockPallet.groupBy({
      by: ['sellerName', 'boxNumber'],
      _count: { _all: true },
    });
    // \u0000-joined so e.g. sellerName="A-B"+boxNumber="C" can't collide
    // with sellerName="A"+boxNumber="B-C" the way a "-"-joined key could.
    const ambiguousKeys = new Set(
      groups.filter((g) => g._count._all > 1).map((g) => `${g.sellerName}\u0000${g.boxNumber}`),
    );
    return rows.map((row) => this.rowToDomain(row, ambiguousKeys.has(`${row.sellerName}\u0000${row.boxNumber}`)));
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

    // A pallet that doesn't need review (Good Condition, not overweight)
    // goes straight to 'put_away' — locations are predefined/obvious to
    // staff (customer request), so there's nothing left to collect or
    // confirm for this path. Anything needing review is untouched: still
    // 'pending_admin_review', no location (that still comes from Admin
    // via PutAwayService — see giveInstructions/updateLocation below).
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
        status: needsReview ? 'pending_admin_review' : 'put_away',
        putAwayLocation: null,
        createdByUserId: userId,
        putAwayAt: needsReview ? null : new Date(),
      },
    });
    return this.toDomain(row);
  }

  async findAll(): Promise<SellerStockPallet[]> {
    const rows = await this.prisma.sellerStockPallet.findMany({ orderBy: { createdAt: 'desc' } });
    return this.toDomainList(rows);
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

  async remove(id: string): Promise<void> {
    await this.findOneRow(id);
    await this.prisma.sellerStockPallet.delete({ where: { id } });
  }

  async removeMany(ids: string[]): Promise<{ deletedCount: number }> {
    const result = await this.prisma.sellerStockPallet.deleteMany({ where: { id: { in: ids } } });
    return { deletedCount: result.count };
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
   * just confirms directly (locations are predefined/obvious, nothing
   * to pick — customer request). Deliberately a separate, simpler path
   * from PutAwayService's assign→start→complete flow (which stays
   * exactly as-is for anything that DID need review): no PutAwayTask
   * row, no per-staff task tracking, since Admin isn't meant to act on
   * or monitor this path at all — just see the aggregate counts
   * (Reports/Admin dashboard already do that). In practice this is now
   * largely a legacy path — see create()'s comment — kept for any
   * pallet that reached 'ready_for_putaway' before that change.
   */
  async selfPutAway(id: string): Promise<SellerStockPallet> {
    const pallet = await this.findOneRow(id);
    if (pallet.status !== 'ready_for_putaway') {
      throw new ConflictException({
        message: `Cannot self-confirm put-away for a pallet in status "${pallet.status}" — only a pallet that skipped admin review (Good Condition, not overweight) qualifies`,
        code: 'seller_stock.not_ready_for_self_putaway',
      });
    }
    const row = await this.prisma.sellerStockPallet.update({
      where: { id },
      data: { status: 'put_away', putAwayAt: new Date() },
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

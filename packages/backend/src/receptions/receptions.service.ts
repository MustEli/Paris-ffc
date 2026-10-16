import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Reception as PrismaReception } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { formatTimestampForSheet, SheetsService } from '../sheets/sheets.service';
import { UsersService } from '../users/users.service';
import { type CreateReceptionDto } from './dto/create-reception.dto';
import { type BulkInstructionResult, type Reception, type ReceptionDetails } from './reception.types';

const REVIEW_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours — doc Step 5

const SHEET_TAB = 'Reception';
const SHEET_HEADER = [
  'Category',
  'Logged By',
  'Arrived (Local)',
  'Put Away (Local)',
  'Processing Time (min)',
  'Flagged',
  'Details',
];

const CATEGORY_LABELS: Record<ReceptionDetails['category'], string> = {
  return_parcels: 'Return Parcels',
  packaging_stock: 'Packaging Stock',
  sellers_stock: 'Sellers Stock',
  equipment_other: 'Equipment & Other',
};

/**
 * Backed by Postgres via Prisma now — see users.service.ts for the
 * pattern and why. ReceptionDetails' discriminated union is flattened
 * into nullable columns on the Reception model (see schema.prisma) —
 * buildDetailsColumns()/toDomain() convert between the two shapes.
 */
@Injectable()
export class ReceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sheetsService: SheetsService,
    private readonly usersService: UsersService,
  ) {}

  private summarizeDetails(details: ReceptionDetails): string {
    switch (details.category) {
      case 'return_parcels':
        return `${details.parcelCount} parcel(s) via ${details.transporterCompany} — put away at ${details.putAwayLocation}`;
      case 'packaging_stock':
        return `${details.parcelCount} parcel(s)/pallet(s) — ${details.packagingType} — seller: ${details.sellerName}`;
      case 'sellers_stock':
        return `${details.palletCount} pallet(s)`;
      case 'equipment_other':
        return `${details.parcelCount} parcel(s) — ${details.itemDescription}`;
    }
  }

  private buildDetails(dto: CreateReceptionDto): ReceptionDetails {
    switch (dto.category) {
      case 'return_parcels':
        if (!dto.parcelCount || !dto.transporterCompany || !dto.putAwayLocation) {
          throw new BadRequestException({
            message: 'return_parcels requires parcelCount, transporterCompany, and putAwayLocation',
            code: 'reception.missing_required_fields',
          });
        }
        return {
          category: 'return_parcels',
          parcelCount: dto.parcelCount,
          transporterCompany: dto.transporterCompany,
          putAwayLocation: dto.putAwayLocation,
        };

      case 'packaging_stock':
        if (!dto.parcelCount || !dto.packagingType || !dto.sellerName) {
          throw new BadRequestException({
            message: 'packaging_stock requires parcelCount, packagingType, and sellerName',
            code: 'reception.missing_required_fields',
          });
        }
        return {
          category: 'packaging_stock',
          parcelCount: dto.parcelCount,
          packagingType: dto.packagingType,
          sellerName: dto.sellerName,
          invoicePhotoUrls: dto.invoicePhotoUrls ?? [],
        };

      case 'sellers_stock':
        if (!dto.palletCount) {
          throw new BadRequestException({
            message: 'sellers_stock requires palletCount',
            code: 'reception.missing_required_fields',
          });
        }
        return { category: 'sellers_stock', palletCount: dto.palletCount };

      case 'equipment_other':
        if (!dto.parcelCount || !dto.itemDescription || !dto.photoUrls?.length) {
          throw new BadRequestException({
            message: 'equipment_other requires parcelCount, itemDescription, and at least one photo',
            code: 'reception.missing_required_fields',
          });
        }
        return {
          category: 'equipment_other',
          parcelCount: dto.parcelCount,
          itemDescription: dto.itemDescription,
          photoUrls: dto.photoUrls,
          invoicePhotoUrls: dto.invoicePhotoUrls ?? [],
        };
    }
  }

  /** The inverse of toDomain's details reconstruction — only the columns matching `category` are populated. */
  private buildDetailsColumns(details: ReceptionDetails) {
    const empty = {
      parcelCount: null,
      transporterCompany: null,
      packagingType: null,
      palletCount: null,
      itemDescription: null,
      photoUrls: [] as string[],
      invoicePhotoUrls: [] as string[],
      sellerName: null,
      putAwayLocation: null,
    };
    switch (details.category) {
      case 'return_parcels':
        return {
          ...empty,
          parcelCount: details.parcelCount,
          transporterCompany: details.transporterCompany,
          putAwayLocation: details.putAwayLocation,
        };
      case 'packaging_stock':
        return {
          ...empty,
          parcelCount: details.parcelCount,
          packagingType: details.packagingType,
          sellerName: details.sellerName,
          invoicePhotoUrls: details.invoicePhotoUrls,
        };
      case 'sellers_stock':
        return { ...empty, palletCount: details.palletCount };
      case 'equipment_other':
        return {
          ...empty,
          parcelCount: details.parcelCount,
          itemDescription: details.itemDescription,
          photoUrls: details.photoUrls,
          invoicePhotoUrls: details.invoicePhotoUrls,
        };
    }
  }

  private toDomain(row: PrismaReception): Reception {
    let details: ReceptionDetails;
    switch (row.category) {
      case 'return_parcels':
        details = {
          category: 'return_parcels',
          parcelCount: row.parcelCount!,
          transporterCompany: row.transporterCompany!,
          // Historical rows pre-date this field — fall back rather than lie about the type with a non-null assertion.
          putAwayLocation: row.putAwayLocation ?? '(not recorded)',
        };
        break;
      case 'packaging_stock':
        details = {
          category: 'packaging_stock',
          parcelCount: row.parcelCount!,
          packagingType: row.packagingType!,
          // Historical rows pre-date this field — fall back rather than lie about the type with a non-null assertion.
          sellerName: row.sellerName ?? '(not recorded)',
          invoicePhotoUrls: row.invoicePhotoUrls,
        };
        break;
      case 'sellers_stock':
        details = { category: 'sellers_stock', palletCount: row.palletCount! };
        break;
      case 'equipment_other':
        details = {
          category: 'equipment_other',
          parcelCount: row.parcelCount!,
          itemDescription: row.itemDescription!,
          photoUrls: row.photoUrls,
          invoicePhotoUrls: row.invoicePhotoUrls,
        };
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

  /**
   * return_parcels skips the admin-instructions wait entirely (customer
   * request): staff record where they put it in the same submission
   * that logs the delivery, so it's created already `completed` —
   * arrivedAt and putAwayAt are the same instant, durationMs is 0, and
   * it's never eligible for the 2-hour review flag. Every other
   * category keeps the normal `arrived` → admin instructs → staff
   * confirms flow, unchanged.
   */
  async create(userId: string, dto: CreateReceptionDto): Promise<Reception> {
    const details = this.buildDetails(dto);
    const arrivedAt = new Date();
    const isInstant = details.category === 'return_parcels';

    const row = await this.prisma.reception.create({
      data: {
        id: randomUUID(),
        createdByUserId: userId,
        status: isInstant ? 'completed' : 'arrived',
        category: details.category,
        arrivedAt,
        putAwayAt: isInstant ? arrivedAt : null,
        processingDurationMs: isInstant ? 0 : null,
        ...this.buildDetailsColumns(details),
      },
    });
    const domain = this.toDomain(row);

    if (isInstant) {
      const user = await this.usersService.findById(userId);
      await this.appendCompletionToSheet(domain, user?.name ?? userId, arrivedAt, arrivedAt, 0);
    }

    return domain;
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

  /**
   * Backs the web dashboard's Excel bulk-instructions flow — each row
   * is applied independently through the exact same addInstructions()
   * used by the single-item flow (same validation, same status
   * transition), so one bad id or wrong-status row never aborts the
   * rest of the batch. The web app shows this per-row result back to
   * Admin rather than a single pass/fail for the whole upload.
   */
  async bulkAddInstructions(items: { id: string; instructions: string }[]): Promise<BulkInstructionResult[]> {
    const results: BulkInstructionResult[] = [];
    for (const item of items) {
      try {
        await this.addInstructions(item.id, item.instructions);
        results.push({ id: item.id, success: true, error: null });
      } catch (error) {
        results.push({
          id: item.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return results;
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
    const domain = this.toDomain(row);
    const user = await this.usersService.findById(reception.createdByUserId);
    await this.appendCompletionToSheet(domain, user?.name ?? reception.createdByUserId, row.arrivedAt, putAwayAt, durationMs);

    return domain;
  }

  // Doc's Feature 2: "All recorded in a Google sheet." Same
  // never-throws/no-op-when-unconfigured contract as Shifts — see
  // SheetsService's class doc comment. Shared by complete() and
  // create()'s return_parcels instant-completion path.
  private async appendCompletionToSheet(
    domain: Reception,
    userName: string,
    arrivedAt: Date,
    putAwayAt: Date,
    durationMs: number,
  ): Promise<void> {
    await this.sheetsService.appendRow(SHEET_TAB, SHEET_HEADER, [
      CATEGORY_LABELS[domain.details.category],
      userName,
      formatTimestampForSheet(arrivedAt),
      formatTimestampForSheet(putAwayAt),
      Math.round(durationMs / 60_000),
      domain.flaggedForReview ? 'Yes' : 'No',
      this.summarizeDetails(domain.details),
    ]);
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type WarehouseLocation as PrismaWarehouseLocation } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { type BulkWarehouseLocationResult, type WarehouseLocation } from './warehouse-location.types';

/**
 * Backs the web dashboard's "Put-Away & Location Assignment" table and
 * every mobile "Put-away location" dropdown (Seller Stock's self
 * put-away, and the instant put-away on Return Parcels / Packaging
 * Stock / Equipment & Other / Good-Condition Seller Stock pallets).
 */
@Injectable()
export class WarehouseLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaWarehouseLocation): WarehouseLocation {
    return {
      id: row.id,
      location: row.location,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(): Promise<WarehouseLocation[]> {
    const rows = await this.prisma.warehouseLocation.findMany({ orderBy: { location: 'asc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async create(location: string, description?: string): Promise<WarehouseLocation> {
    const trimmedLocation = location.trim();
    if (!trimmedLocation) {
      throw new BadRequestException('Location cannot be empty');
    }
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { location: { equals: trimmedLocation, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('This location already exists');
    }

    const row = await this.prisma.warehouseLocation.create({
      data: { location: trimmedLocation, description: description?.trim() || null },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: { location?: string; description?: string }): Promise<WarehouseLocation> {
    const current = await this.prisma.warehouseLocation.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Location not found');
    }

    if (data.location !== undefined) {
      const trimmedLocation = data.location.trim();
      if (!trimmedLocation) {
        throw new BadRequestException('Location cannot be empty');
      }
      const existing = await this.prisma.warehouseLocation.findFirst({
        where: { location: { equals: trimmedLocation, mode: 'insensitive' }, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('This location already exists');
      }
    }

    const row = await this.prisma.warehouseLocation.update({
      where: { id },
      data: {
        location: data.location !== undefined ? data.location.trim() : undefined,
        description: data.description !== undefined ? data.description.trim() || null : undefined,
      },
    });
    return this.toDomain(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.warehouseLocation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Location not found');
    }
    await this.prisma.warehouseLocation.delete({ where: { id } });
  }

  /**
   * Backs the web dashboard's Excel bulk-upload flow — each row is
   * applied independently (create new, or update the description of an
   * existing location by exact name match), so one bad row never aborts
   * the rest of the batch.
   */
  async bulkUpsert(rows: { location: string; description?: string }[]): Promise<BulkWarehouseLocationResult[]> {
    const results: BulkWarehouseLocationResult[] = [];
    for (const row of rows) {
      const trimmedLocation = row.location.trim();
      try {
        if (!trimmedLocation) {
          throw new BadRequestException('Location cannot be empty');
        }
        const existing = await this.prisma.warehouseLocation.findFirst({
          where: { location: { equals: trimmedLocation, mode: 'insensitive' } },
        });
        if (existing) {
          await this.prisma.warehouseLocation.update({
            where: { id: existing.id },
            data: { description: row.description?.trim() || null },
          });
        } else {
          await this.prisma.warehouseLocation.create({
            data: { location: trimmedLocation, description: row.description?.trim() || null },
          });
        }
        results.push({ location: trimmedLocation, success: true });
      } catch (error) {
        results.push({
          location: trimmedLocation,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return results;
  }
}

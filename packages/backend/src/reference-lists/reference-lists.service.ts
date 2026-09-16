import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type ReferenceListValue as PrismaReferenceListValue } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import {
  isReferenceListCategory,
  REFERENCE_LIST_CATEGORIES,
  type ReferenceListCategory,
  type ReferenceListValue,
} from './reference-list.types';

/**
 * Backs the web dashboard's generic "Manage Lists" screen and the
 * dropdowns those lists feed on mobile (e.g. Reception's Transporter
 * Company / Packaging Type fields). One category-agnostic CRUD surface
 * — see reference-list.types.ts for how a new category gets added.
 */
@Injectable()
export class ReferenceListsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaReferenceListValue): ReferenceListValue {
    return {
      id: row.id,
      category: row.category,
      value: row.value,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Throws instead of silently returning nothing for a typo'd/unknown category in a URL param. */
  private assertValidCategory(category: string): asserts category is ReferenceListCategory {
    if (!isReferenceListCategory(category)) {
      throw new BadRequestException(
        `Unknown reference list category "${category}" — expected one of: ${REFERENCE_LIST_CATEGORIES.join(', ')}`,
      );
    }
  }

  async findAll(): Promise<Record<ReferenceListCategory, ReferenceListValue[]>> {
    const rows = await this.prisma.referenceListValue.findMany({ orderBy: { value: 'asc' } });
    const result = REFERENCE_LIST_CATEGORIES.reduce(
      (acc, category) => {
        acc[category] = [];
        return acc;
      },
      {} as Record<ReferenceListCategory, ReferenceListValue[]>,
    );
    for (const row of rows) {
      result[row.category].push(this.toDomain(row));
    }
    return result;
  }

  async findByCategory(category: string): Promise<ReferenceListValue[]> {
    this.assertValidCategory(category);
    const rows = await this.prisma.referenceListValue.findMany({ where: { category }, orderBy: { value: 'asc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async create(category: string, value: string): Promise<ReferenceListValue> {
    this.assertValidCategory(category);
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('Value cannot be empty');
    }
    const existing = await this.prisma.referenceListValue.findFirst({
      where: { category, value: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('This value already exists in the list');
    }

    const row = await this.prisma.referenceListValue.create({
      data: { id: randomUUID(), category, value: trimmed },
    });
    return this.toDomain(row);
  }

  async remove(category: string, id: string): Promise<void> {
    this.assertValidCategory(category);
    const row = await this.prisma.referenceListValue.findFirst({ where: { id, category } });
    if (!row) {
      throw new NotFoundException('Value not found');
    }
    await this.prisma.referenceListValue.delete({ where: { id } });
  }
}

import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { type ReceptionCategory } from '../reception.types';

const CATEGORIES: ReceptionCategory[] = [
  'return_parcels',
  'packaging_stock',
  'sellers_stock',
  'equipment_other',
];

/**
 * Deliberately loose: fields required vary by category (see
 * receptions.service.ts#validateDetailsForCategory for the per-category
 * checks). A fully-typed discriminated-union DTO would need 4 near-
 * duplicate classes for not much benefit at this scale.
 */
export class CreateReceptionDto {
  @IsIn(CATEGORIES)
  category!: ReceptionCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  parcelCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  palletCount?: number;

  @IsOptional()
  @IsString()
  transporterCompany?: string;

  @IsOptional()
  @IsString()
  packagingType?: string;

  @IsOptional()
  @IsString()
  itemDescription?: string;
}

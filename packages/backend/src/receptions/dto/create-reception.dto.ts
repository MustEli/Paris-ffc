import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { type ReceptionCategory } from '../reception.types';

/**
 * `sellers_stock` is deliberately excluded here — Reception no longer
 * accepts *new* entries in that category (redundant now that Seller
 * Stock is its own dedicated feature/tab), but it's intentionally NOT
 * removed from `ReceptionCategory` itself (reception.types.ts) or
 * anywhere that only *reads* existing data — real historical
 * `sellers_stock` receptions already exist in production and must keep
 * displaying correctly.
 */
const CREATABLE_CATEGORIES: ReceptionCategory[] = ['return_parcels', 'packaging_stock', 'equipment_other'];

/**
 * Deliberately loose: fields required vary by category (see
 * receptions.service.ts#validateDetailsForCategory for the per-category
 * checks). A fully-typed discriminated-union DTO would need 4 near-
 * duplicate classes for not much benefit at this scale.
 */
export class CreateReceptionDto {
  @IsIn(CREATABLE_CATEGORIES)
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

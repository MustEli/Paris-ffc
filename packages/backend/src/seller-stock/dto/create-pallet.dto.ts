import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

import { type PalletCondition } from '../seller-stock.types';

export class CreatePalletDto {
  // Not @IsUrl(): POST /uploads returns a relative path ("/uploads/xyz.jpg"),
  // not an absolute URL — the client prefixes it with the API base URL when
  // displaying. A non-empty string is all that's actually guaranteed here.
  @IsString()
  @MinLength(1)
  labelPhotoUrl!: string;

  @IsString()
  @MinLength(1)
  boxNumber!: string;

  @IsString()
  @MinLength(1)
  sellerName!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  weightKg!: number;

  @IsIn(['good', 'damaged'])
  condition!: PalletCondition;

  @IsOptional()
  @IsString()
  @MinLength(1)
  damageRemarks?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  damageEvidencePhotoUrls?: string[];
}

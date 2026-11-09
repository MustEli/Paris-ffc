import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class BulkWarehouseLocationItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** Backs the web dashboard's "download template → fill in → re-upload" bulk-locations flow. */
export class BulkUpsertWarehouseLocationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkWarehouseLocationItemDto)
  rows!: BulkWarehouseLocationItemDto[];
}

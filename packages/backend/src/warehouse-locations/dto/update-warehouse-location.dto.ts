import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWarehouseLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

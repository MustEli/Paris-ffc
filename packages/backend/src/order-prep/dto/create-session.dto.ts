import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CreateSessionDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  totalParts!: number;
}

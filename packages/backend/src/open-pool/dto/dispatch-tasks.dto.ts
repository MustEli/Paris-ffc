import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class DispatchTaskItemDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(1)
  comment!: string;
}

/** Backs the web dashboard's "Pending Instructions" / "Seller Stock Photos" bulk-dispatch-as-task flows. */
export class DispatchTasksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchTaskItemDto)
  items!: DispatchTaskItemDto[];

  /** Omit for "anyone available" — first staff member to claim wins. */
  @IsOptional()
  @IsString()
  targetUserId?: string;
}

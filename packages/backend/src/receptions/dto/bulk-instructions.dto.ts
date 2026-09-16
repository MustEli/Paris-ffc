import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class BulkInstructionItemDto {
  @IsString()
  id!: string;

  @IsString()
  @MinLength(1)
  instructions!: string;
}

/** Backs the web dashboard's "download template → fill in → re-upload" bulk-instructions flow. */
export class BulkInstructionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkInstructionItemDto)
  items!: BulkInstructionItemDto[];
}

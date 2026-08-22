import { IsOptional, IsString, MinLength } from 'class-validator';

export class ReassignTaskDto {
  @IsString()
  @MinLength(1)
  assignedToUserId!: string;

  /** Optional — keeps the existing location if the reassignment isn't about a bad address. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  location?: string;
}

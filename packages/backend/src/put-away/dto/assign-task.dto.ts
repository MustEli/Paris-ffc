import { IsString, MinLength } from 'class-validator';

export class AssignTaskDto {
  @IsString()
  @MinLength(1)
  palletId!: string;

  @IsString()
  @MinLength(1)
  assignedToUserId!: string;

  @IsString()
  @MinLength(1)
  location!: string;
}

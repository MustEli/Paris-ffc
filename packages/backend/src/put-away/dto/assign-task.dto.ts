import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { TASK_PRIORITIES, type TaskPriority } from '../../tasks/task-priority';

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

  /** Defaults to 'normal' when omitted — existing callers that don't send this keep working unchanged. */
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  instructions?: string;
}

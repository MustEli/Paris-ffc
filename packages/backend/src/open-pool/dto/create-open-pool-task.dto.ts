import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { TASK_PRIORITIES, type TaskPriority } from '../../tasks/task-priority';

export class CreateOpenPoolTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  /** Omit for "anyone available" — first staff member to claim wins. */
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @MinLength(1)
  creationPhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  creationComment?: string;
}

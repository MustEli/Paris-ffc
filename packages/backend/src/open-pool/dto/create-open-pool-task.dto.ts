import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { TASK_PRIORITIES, type TaskPriority } from '../../tasks/task-priority';

export class CreateOpenPoolTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;
}

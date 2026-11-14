import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { TASK_PRIORITIES, type TaskPriority } from '../../tasks/task-priority';

export class AssignReceptionDto {
  @IsString()
  @MinLength(1)
  assignedToUserId!: string;

  @IsString()
  @MinLength(1)
  instructions!: string;

  /** Defaults to 'normal' when omitted — same convention as put-away/order-prep assignment. */
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;
}

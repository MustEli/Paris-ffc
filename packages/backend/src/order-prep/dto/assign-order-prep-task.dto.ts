import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { type OrderPrepTaskRole } from '../order-prep.types';
import { TASK_PRIORITIES, type TaskPriority } from '../../tasks/task-priority';

export class AssignOrderPrepTaskDto {
  @IsString()
  @MinLength(1)
  assignedToUserId!: string;

  @IsIn(['picker', 'packer'])
  role!: OrderPrepTaskRole;

  /** Defaults to 'normal' when omitted — existing callers that don't send this keep working unchanged. */
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  instructions?: string;
}

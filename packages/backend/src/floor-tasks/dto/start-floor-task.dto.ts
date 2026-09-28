import { IsIn } from 'class-validator';

import { FLOOR_TASK_CATEGORIES, type FloorTaskCategory } from '../floor-task.types';

export class StartFloorTaskDto {
  @IsIn(FLOOR_TASK_CATEGORIES)
  category!: FloorTaskCategory;
}

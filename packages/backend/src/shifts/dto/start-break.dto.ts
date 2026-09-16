import { IsIn } from 'class-validator';

import { type BreakType } from '../shift.types';

export class StartBreakDto {
  @IsIn(['lunch', 'short'])
  type!: BreakType;
}

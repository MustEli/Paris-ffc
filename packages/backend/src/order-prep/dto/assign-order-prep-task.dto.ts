import { IsIn, IsString, MinLength } from 'class-validator';

import { type OrderPrepTaskRole } from '../order-prep.types';

export class AssignOrderPrepTaskDto {
  @IsString()
  @MinLength(1)
  assignedToUserId!: string;

  @IsIn(['picker', 'packer'])
  role!: OrderPrepTaskRole;
}

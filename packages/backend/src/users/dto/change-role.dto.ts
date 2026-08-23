import { IsIn } from 'class-validator';

import { type Role } from '../user.types';

export class ChangeRoleDto {
  @IsIn(['staff', 'admin', 'management'])
  role!: Role;
}

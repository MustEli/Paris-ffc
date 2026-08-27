import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

import { type Role } from '../user.types';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['staff', 'admin', 'management'])
  role!: Role;

  /**
   * Trial-gating, optional — never sent by the mobile app's "New user"
   * form, only used when creating an account for an evaluating company.
   * Omitted (undefined) means the normal, unlimited defaults apply.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  loginLimit?: number;

  @IsOptional()
  @IsBoolean()
  canCreateUsers?: boolean;
}

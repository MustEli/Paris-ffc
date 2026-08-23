import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

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
}

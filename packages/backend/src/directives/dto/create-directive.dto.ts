import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { DIRECTIVE_TYPES, type DirectiveType } from '../directive.types';

export class CreateDirectiveDto {
  /** Omit for "anyone available" — first staff member to acknowledge wins. */
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsIn(DIRECTIVE_TYPES)
  type!: DirectiveType;

  @IsString()
  @MinLength(1)
  message!: string;
}

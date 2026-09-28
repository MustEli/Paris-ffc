import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveDirectiveDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  photoUrl?: string;
}

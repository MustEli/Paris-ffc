import { IsString, MinLength } from 'class-validator';

export class ResolveDirectiveDto {
  @IsString()
  @MinLength(1)
  completionPhotoUrl!: string;

  @IsString()
  @MinLength(1)
  completionComment!: string;
}

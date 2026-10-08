import { IsString, MinLength } from 'class-validator';

export class SetPhotoDto {
  @IsString()
  @MinLength(1)
  photoUrl!: string;
}

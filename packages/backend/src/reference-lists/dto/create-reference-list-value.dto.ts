import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReferenceListValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value!: string;
}

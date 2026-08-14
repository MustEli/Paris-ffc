import { IsString, MinLength } from 'class-validator';

export class PutAwayInstructionsDto {
  @IsString()
  @MinLength(1)
  location!: string;
}

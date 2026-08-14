import { IsString, MinLength } from 'class-validator';

export class InstructionsDto {
  @IsString()
  @MinLength(1)
  instructions!: string;
}

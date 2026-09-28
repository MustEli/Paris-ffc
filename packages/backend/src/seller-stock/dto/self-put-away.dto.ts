import { IsString, MinLength } from 'class-validator';

export class SelfPutAwayDto {
  @IsString()
  @MinLength(1)
  zone!: string;
}

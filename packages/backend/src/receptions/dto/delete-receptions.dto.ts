import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DeleteReceptionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

import { FLOOR_TASK_MAX_PHOTOS } from '../floor-task.types';

export class EndFloorTaskDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  count?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  countExtra?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  zone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FLOOR_TASK_MAX_PHOTOS)
  @IsString({ each: true })
  photoUrls?: string[];
}

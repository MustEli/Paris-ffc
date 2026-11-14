import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

import { FLOOR_TASK_MAX_PHOTOS } from '../floor-task.types';
import { TRACKING_ID_PATTERN } from '../../issue-reports/issue-report.types';

export class EndFloorTaskDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  count?: number;

  /** 'dispatch' category only — same format rule as Issue Reporting's Tracking ID scanner. */
  @IsOptional()
  @Matches(TRACKING_ID_PATTERN, { message: 'scannedBarcode must be capital letters and numbers only, no spaces' })
  scannedBarcode?: string;

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

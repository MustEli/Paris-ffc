import { IsArray, IsIn, IsInt, IsOptional, IsPositive, Matches } from 'class-validator';

import { HH_MM_PATTERN, WEEKDAYS, type Weekday } from '../schedule.types';

export class SetScheduleDto {
  @IsArray()
  @IsIn(WEEKDAYS, { each: true })
  workingDays!: Weekday[];

  @Matches(HH_MM_PATTERN, { message: 'shiftStartTime must be "HH:MM"' })
  shiftStartTime!: string;

  @Matches(HH_MM_PATTERN, { message: 'shiftEndTime must be "HH:MM"' })
  shiftEndTime!: string;

  @IsPositive()
  requiredWorkingHours!: number;

  @IsOptional()
  @Matches(HH_MM_PATTERN, { message: 'paidBreakStartTime must be "HH:MM"' })
  paidBreakStartTime?: string;

  @IsOptional()
  @Matches(HH_MM_PATTERN, { message: 'lunchBreakStartTime must be "HH:MM"' })
  lunchBreakStartTime?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  lunchBreakDurationMinutes?: number;
}

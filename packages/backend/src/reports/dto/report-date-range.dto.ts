import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { type ReportGranularity } from '../reports.types';

/** Shared by the 5 Reception Reports endpoints — all optional, defaulting to "day" granularity and the full data range when omitted. */
export class ReportDateRangeQuery {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'quarter'])
  granularity?: ReportGranularity;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}

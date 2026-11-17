import { IsArray, IsIn, IsOptional, IsString, Matches } from 'class-validator';

import {
  ISSUE_REPORT_CATEGORIES,
  NUMERIC_ONLY_PATTERN,
  TRACKING_ID_PATTERN,
  type IssueReportCategory,
} from '../issue-report.types';

/**
 * Deliberately loose, same convention as CreateReceptionDto: which
 * fields are actually required varies by category (see
 * issue-reports.service.ts#validateFieldsForCategory). This only
 * validates the *shape* of a field when it's present.
 */
export class CreateIssueReportDto {
  @IsIn(ISSUE_REPORT_CATEGORIES)
  category!: IssueReportCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @Matches(TRACKING_ID_PATTERN, { message: 'trackingId must be capital letters and numbers only, no spaces' })
  trackingId?: string;

  @IsOptional()
  @Matches(NUMERIC_ONLY_PATTERN, { message: 'orderNumber must contain numbers only' })
  orderNumber?: string;

  @IsOptional()
  @IsString()
  errorNo?: string;

  @IsOptional()
  @Matches(NUMERIC_ONLY_PATTERN, { message: 'idNumber must contain numbers only' })
  idNumber?: string;

  /** Deliberately no character-set restriction — client location names may contain any character. */
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  contextLabel?: string;
}

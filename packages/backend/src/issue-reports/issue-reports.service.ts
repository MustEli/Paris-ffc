import { BadRequestException, Injectable } from '@nestjs/common';
import { type IssueReport as PrismaIssueReport } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { type PublicUser } from '../users/user.types';
import { type CreateIssueReportDto } from './dto/create-issue-report.dto';
import {
  ALERTING_CATEGORIES,
  type IssueReport,
  type IssueReportCategory,
  type IssueReportWithReporter,
} from './issue-report.types';

/** Categories requiring at least one photo — every one of the 9 except "No Return Request Generated" and "Other" (comment-only). */
const REQUIRES_PHOTO: IssueReportCategory[] = [
  'non_traceable_return_parcel',
  'non_fulfillment_return_parcel',
  'shipment_label_not_generatable',
  'item_found_out_of_location',
  'empty_crate',
  'part_broken_in_location',
  'heavy_crate',
];
const REQUIRES_TRACKING_ID: IssueReportCategory[] = [
  'non_traceable_return_parcel',
  'non_fulfillment_return_parcel',
  'no_return_request_generated',
];
const REQUIRES_ORDER_NUMBER: IssueReportCategory[] = ['no_return_request_generated', 'shipment_label_not_generatable'];
const REQUIRES_ERROR_NO: IssueReportCategory[] = ['shipment_label_not_generatable'];
const REQUIRES_ID_NUMBER: IssueReportCategory[] = ['item_found_out_of_location'];
const REQUIRES_LOCATION_ID: IssueReportCategory[] = ['empty_crate', 'part_broken_in_location', 'heavy_crate'];
const REQUIRES_COMMENT: IssueReportCategory[] = [
  'non_traceable_return_parcel',
  'non_fulfillment_return_parcel',
  'no_return_request_generated',
  'shipment_label_not_generatable',
  'item_found_out_of_location',
  'part_broken_in_location',
  'other',
];

/**
 * Staff-view redesign's Issue Reporting — see issue-report.types.ts for
 * the per-category field doc. Create-only from Staff's side (no
 * start/end lifecycle like FloorTaskLog — this is a one-shot report),
 * with a real-time push to Admin for the categories that warrant one.
 */
@Injectable()
export class IssueReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private toDomain(row: PrismaIssueReport): IssueReport {
    return {
      id: row.id,
      userId: row.userId,
      category: row.category,
      photoUrls: row.photoUrls,
      trackingId: row.trackingId,
      orderNumber: row.orderNumber,
      errorNo: row.errorNo,
      idNumber: row.idNumber,
      locationId: row.locationId,
      comment: row.comment,
      alertsAdmin: row.alertsAdmin,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private validateFieldsForCategory(dto: CreateIssueReportDto): void {
    const code = 'issue_report.missing_required_fields';
    if (REQUIRES_PHOTO.includes(dto.category) && !dto.photoUrls?.length) {
      throw new BadRequestException({ message: `At least one photo is required for "${dto.category}"`, code });
    }
    if (REQUIRES_TRACKING_ID.includes(dto.category) && !dto.trackingId) {
      throw new BadRequestException({ message: `trackingId is required for "${dto.category}"`, code });
    }
    if (REQUIRES_ORDER_NUMBER.includes(dto.category) && !dto.orderNumber) {
      throw new BadRequestException({ message: `orderNumber is required for "${dto.category}"`, code });
    }
    if (REQUIRES_ERROR_NO.includes(dto.category) && !dto.errorNo) {
      throw new BadRequestException({ message: `errorNo is required for "${dto.category}"`, code });
    }
    if (REQUIRES_ID_NUMBER.includes(dto.category) && !dto.idNumber) {
      throw new BadRequestException({ message: `idNumber is required for "${dto.category}"`, code });
    }
    if (REQUIRES_LOCATION_ID.includes(dto.category) && !dto.locationId) {
      throw new BadRequestException({ message: `locationId is required for "${dto.category}"`, code });
    }
    if (REQUIRES_COMMENT.includes(dto.category) && !dto.comment) {
      throw new BadRequestException({ message: `comment is required for "${dto.category}"`, code });
    }
  }

  async create(user: PublicUser, dto: CreateIssueReportDto): Promise<IssueReport> {
    this.validateFieldsForCategory(dto);

    const alertsAdmin = ALERTING_CATEGORIES.includes(dto.category);
    const row = await this.prisma.issueReport.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        category: dto.category,
        photoUrls: dto.photoUrls ?? [],
        trackingId: dto.trackingId ?? null,
        orderNumber: dto.orderNumber ?? null,
        errorNo: dto.errorNo ?? null,
        idNumber: dto.idNumber ?? null,
        locationId: dto.locationId ?? null,
        comment: dto.comment ?? null,
        alertsAdmin,
      },
    });
    const report = this.toDomain(row);

    if (alertsAdmin) {
      this.realtime.emitToRole('admin', 'issue_report.created', { ...report, userName: user.name });
    }

    return report;
  }

  async findAll(): Promise<IssueReportWithReporter[]> {
    const rows = await this.prisma.issueReport.findMany({ orderBy: { createdAt: 'desc' } });
    if (rows.length === 0) return [];

    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } } });
    const nameByUserId = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((row) => ({
      ...this.toDomain(row),
      userName: nameByUserId.get(row.userId) ?? 'Unknown',
    }));
  }
}

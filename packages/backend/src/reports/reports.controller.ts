import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportDateRangeQuery } from './dto/report-date-range.dto';
import { ReportsService } from './reports.service';
import { type StaffActivityScope } from './reports.types';

/**
 * Admin + management, read-only — same convention as GET /users. Admin
 * already has direct list/detail access to the underlying records
 * (Reception log, Seller Stock pipeline, etc.); these aggregate
 * endpoints are what power Management's dashboard specifically, per
 * Feature 0's "Management Interface: Reporting tools and visual
 * analytics dashboards."
 */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'management')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  overview() {
    return this.reportsService.overview();
  }

  @Get('attendance')
  attendance() {
    return this.reportsService.attendance();
  }

  @Get('staff-history')
  staffHistory() {
    return this.reportsService.staffHistory();
  }

  /** `scope` defaults to 'live' when omitted. */
  @Get('staff-activity')
  staffActivity(@Query('scope') scope?: StaffActivityScope) {
    return this.reportsService.staffActivity(scope === 'recent' ? 'recent' : 'live');
  }

  @Get('reception')
  reception() {
    return this.reportsService.reception();
  }

  /** Reception Reports section: total deliveries by period/category, latest-vs-previous-period change, day-of-week pattern. */
  @Get('reception-volume')
  receptionVolume(@Query() query: ReportDateRangeQuery) {
    return this.reportsService.receptionVolume(query);
  }

  /** Reception Reports section: average Reception-task duration by period/category/staff. */
  @Get('reception-duration')
  receptionDuration(@Query() query: ReportDateRangeQuery) {
    return this.reportsService.receptionDuration(query);
  }

  /** Reception Reports section: Seller Stock condition-problem and overweight rates, by seller/problem-type/period. */
  @Get('seller-stock-quality')
  sellerStockQuality(@Query() query: ReportDateRangeQuery) {
    return this.reportsService.sellerStockQuality(query);
  }

  /** Reception Reports section: Return Parcels quantity by transporter company, by period. */
  @Get('reception-sources')
  receptionSources(@Query() query: ReportDateRangeQuery) {
    return this.reportsService.receptionSources(query);
  }

  /** Reception Reports section: rate of Reception tasks left with no confirmed delivery, by period/staff. */
  @Get('reception-reliability')
  receptionReliability(@Query() query: ReportDateRangeQuery) {
    return this.reportsService.receptionReliability(query);
  }

  @Get('put-away')
  putAway() {
    return this.reportsService.putAway();
  }

  @Get('order-prep')
  orderPrep() {
    return this.reportsService.orderPrep();
  }

  /** Admin's home-screen dashboard — "what's happening right now" plus today's activity, per-staff. */
  @Get('admin-dashboard')
  adminDashboard() {
    return this.reportsService.adminDashboard();
  }

  /**
   * Manual trigger — appends a timestamped snapshot of every report to
   * the Google Sheet configured via GOOGLE_SHEETS_SPREADSHEET_ID (see
   * SheetsService). A no-op that still returns success if Sheets export
   * isn't configured, since that's a legitimate, expected state (local
   * dev, or a deploy that hasn't set it up yet).
   */
  @Post('export-to-sheets')
  async exportToSheets() {
    await this.reportsService.exportSnapshotToSheets();
    return { success: true };
  }
}

import { Controller, Get, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

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

  @Get('reception')
  reception() {
    return this.reportsService.reception();
  }

  @Get('put-away')
  putAway() {
    return this.reportsService.putAway();
  }

  @Get('order-prep')
  orderPrep() {
    return this.reportsService.orderPrep();
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

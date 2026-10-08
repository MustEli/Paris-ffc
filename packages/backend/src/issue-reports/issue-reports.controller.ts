import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { IssueReportsService } from './issue-reports.service';

/** ActiveShiftGuard only ever checks anything for Staff — Admin's review list here is unaffected. */
@Controller('issue-reports')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class IssueReportsController {
  constructor(private readonly issueReportsService: IssueReportsService) {}

  @Post()
  create(@Body() dto: CreateIssueReportDto, @CurrentUser() user: PublicUser) {
    return this.issueReportsService.create(user, dto);
  }

  @Get()
  @Roles('admin', 'management')
  findAll() {
    return this.issueReportsService.findAll();
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { ReportIssueDto } from './dto/report-issue.dto';
import { PutAwayService } from './put-away.service';

@Controller('put-away-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PutAwayController {
  constructor(private readonly putAwayService: PutAwayService) {}

  @Post()
  @Roles('admin')
  assign(@Body() dto: AssignTaskDto, @CurrentUser() user: PublicUser) {
    return this.putAwayService.assign(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: PublicUser) {
    return this.putAwayService.findAllForUser(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.putAwayService.findOneForUser(id, user);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.putAwayService.start(id, user);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.putAwayService.complete(id, user);
  }

  @Post(':id/report-issue')
  reportIssue(@Param('id') id: string, @Body() dto: ReportIssueDto, @CurrentUser() user: PublicUser) {
    return this.putAwayService.reportIssue(id, user, dto.description);
  }

  @Post(':id/reassign')
  @Roles('admin')
  reassign(@Param('id') id: string, @Body() dto: ReassignTaskDto) {
    return this.putAwayService.reassign(id, dto);
  }
}

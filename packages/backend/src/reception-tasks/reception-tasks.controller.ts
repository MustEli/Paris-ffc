import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { ReceptionTasksService } from './reception-tasks.service';

/** ActiveShiftGuard only ever checks anything for Staff — mirrors floor-tasks.controller.ts exactly. */
@Controller('reception-tasks')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class ReceptionTasksController {
  constructor(private readonly receptionTasksService: ReceptionTasksService) {}

  @Post('start')
  start(@CurrentUser() user: PublicUser) {
    return this.receptionTasksService.start(user.id);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.receptionTasksService.pause(id, user);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.receptionTasksService.resume(id, user);
  }

  @Post(':id/leave-unfinished')
  leaveUnfinished(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.receptionTasksService.leaveUnfinished(id, user);
  }

  @Get('mine/active')
  findMineActive(@CurrentUser() user: PublicUser) {
    return this.receptionTasksService.findMineActive(user.id);
  }
}

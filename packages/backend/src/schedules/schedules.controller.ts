import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type PublicUser } from '../users/user.types';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /** Staff reads their own assigned schedule (shift hours, working days, break reminders) — no schedule set yet returns null, not an error. */
  @Get('me')
  getMine(@CurrentUser() user: PublicUser) {
    return this.schedulesService.get(user.id);
  }

  @Get(':userId')
  @Roles('admin')
  getOne(@Param('userId') userId: string) {
    return this.schedulesService.get(userId);
  }

  @Put(':userId')
  @Roles('admin')
  setOne(@Param('userId') userId: string, @Body() dto: SetScheduleDto) {
    return this.schedulesService.set(userId, dto);
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { EndFloorTaskDto } from './dto/end-floor-task.dto';
import { StartFloorTaskDto } from './dto/start-floor-task.dto';
import { FloorTasksService } from './floor-tasks.service';

/** ActiveShiftGuard only ever checks anything for Staff — Admin's live-view endpoint here is unaffected. */
@Controller('floor-tasks')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class FloorTasksController {
  constructor(private readonly floorTasksService: FloorTasksService) {}

  @Post('start')
  start(@Body() dto: StartFloorTaskDto, @CurrentUser() user: PublicUser) {
    return this.floorTasksService.start(user.id, dto.category);
  }

  @Post(':id/end')
  end(@Param('id') id: string, @Body() dto: EndFloorTaskDto, @CurrentUser() user: PublicUser) {
    return this.floorTasksService.end(id, user, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: PublicUser) {
    return this.floorTasksService.findMine(user.id);
  }

  @Get('mine/open')
  findMineOpen(@CurrentUser() user: PublicUser) {
    return this.floorTasksService.findMineOpen(user.id);
  }

  @Get('active')
  @Roles('admin', 'management')
  findAllActive() {
    return this.floorTasksService.findAllActive();
  }
}

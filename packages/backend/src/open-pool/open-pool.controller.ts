import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { CompleteOpenPoolTaskDto } from './dto/complete-open-pool-task.dto';
import { CreateOpenPoolTaskDto } from './dto/create-open-pool-task.dto';
import { DispatchTasksDto } from './dto/dispatch-tasks.dto';
import { OpenPoolService } from './open-pool.service';

/** ActiveShiftGuard only ever checks anything for Staff — Admin's create/list-all endpoints here are unaffected. */
@Controller('open-pool-tasks')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class OpenPoolController {
  constructor(private readonly openPoolService: OpenPoolService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateOpenPoolTaskDto, @CurrentUser() user: PublicUser) {
    return this.openPoolService.create(user.id, dto);
  }

  @Get()
  @Roles('admin', 'management')
  findAll() {
    return this.openPoolService.findAll();
  }

  @Get('open')
  findOpen(@CurrentUser() user: PublicUser) {
    return this.openPoolService.findOpen(user.id);
  }

  @Get('mine')
  findMine(@CurrentUser() user: PublicUser) {
    return this.openPoolService.findMine(user.id);
  }

  @Post('dispatch-receptions')
  @Roles('admin')
  dispatchFromReceptions(@Body() dto: DispatchTasksDto, @CurrentUser() user: PublicUser) {
    return this.openPoolService.dispatchFromReceptions(user.id, dto.items, dto.targetUserId);
  }

  @Post('dispatch-pallets')
  @Roles('admin')
  dispatchFromPallets(@Body() dto: DispatchTasksDto, @CurrentUser() user: PublicUser) {
    return this.openPoolService.dispatchFromPallets(user.id, dto.items, dto.targetUserId);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.openPoolService.claim(id, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteOpenPoolTaskDto, @CurrentUser() user: PublicUser) {
    return this.openPoolService.complete(id, user, dto);
  }
}

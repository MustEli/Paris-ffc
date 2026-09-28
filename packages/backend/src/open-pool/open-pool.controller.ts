import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { CreateOpenPoolTaskDto } from './dto/create-open-pool-task.dto';
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
  findOpen() {
    return this.openPoolService.findOpen();
  }

  @Get('mine')
  findMine(@CurrentUser() user: PublicUser) {
    return this.openPoolService.findMine(user.id);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.openPoolService.claim(id, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.openPoolService.complete(id, user);
  }
}

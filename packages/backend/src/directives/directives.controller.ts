import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveShiftGuard } from '../shifts/active-shift.guard';
import { type PublicUser } from '../users/user.types';
import { CreateDirectiveDto } from './dto/create-directive.dto';
import { ResolveDirectiveDto } from './dto/resolve-directive.dto';
import { DirectivesService } from './directives.service';

/** ActiveShiftGuard only ever checks anything for Staff — Admin's create/list-all endpoints here are unaffected. */
@Controller('directives')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
export class DirectivesController {
  constructor(private readonly directivesService: DirectivesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateDirectiveDto, @CurrentUser() user: PublicUser) {
    return this.directivesService.create(user.id, dto);
  }

  @Get()
  @Roles('admin', 'management')
  findAll() {
    return this.directivesService.findAll();
  }

  @Get('mine')
  findMine(@CurrentUser() user: PublicUser) {
    return this.directivesService.findMineActive(user.id);
  }

  @Post(':id/acknowledge')
  acknowledge(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.directivesService.acknowledge(id, user.id);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveDirectiveDto, @CurrentUser() user: PublicUser) {
    return this.directivesService.resolve(id, user.id, dto.photoUrl);
  }
}

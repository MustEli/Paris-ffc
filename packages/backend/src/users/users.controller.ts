import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { toPublicUser, type PublicUser, type Role } from './user.types';
import { UsersService } from './users.service';

/**
 * GET is admin+management (read-only, e.g. the "assign to staff"
 * picker). Create/remove/changeRole are admin-only — the doc's "Admin
 * should be able to create and remove the accesses and assign
 * different access to different member," finally built instead of
 * deferred. Each real person gets their own account now; the 3 seeded
 * dev accounts are just the initial data, not a hard limit anymore.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'management')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query('role') role?: Role) {
    return (await this.usersService.findAll(role)).map(toPublicUser);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return toPublicUser(await this.usersService.findOneOrThrow(id));
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto) {
    return toPublicUser(await this.usersService.create(dto));
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    await this.usersService.remove(id, user.id);
    return { success: true };
  }

  @Post(':id/role')
  @Roles('admin')
  async changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto, @CurrentUser() user: PublicUser) {
    return toPublicUser(await this.usersService.changeRole(id, dto.role, user.id));
  }
}

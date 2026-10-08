import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChangeRoleDto } from './dto/change-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetPhotoDto } from './dto/set-photo.dto';
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

  /**
   * Self-serve selfie capture (Staff-view redesign) — overrides the
   * class-level @Roles('admin', 'management') since every role may set
   * their own photo. Always acts on the caller, never :id, so there's
   * no need for an ownership check.
   */
  @Patch('me/photo')
  @Roles('admin', 'management', 'staff')
  async setMyPhoto(@Body() dto: SetPhotoDto, @CurrentUser() user: PublicUser) {
    return toPublicUser(await this.usersService.setPhoto(user.id, dto.photoUrl));
  }

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
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: PublicUser) {
    return toPublicUser(await this.usersService.create(dto, user.id));
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

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { type Role } from './user.types';
import { toPublicUser } from './user.types';
import { UsersService } from './users.service';

/**
 * Read-only for now — just enough to power the "assign to staff" picker
 * in Put-Away. Real account management (Admin creating/removing users)
 * is a separate, still-deferred feature — see docs/architecture.md.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'management')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role).map(toPublicUser);
  }
}

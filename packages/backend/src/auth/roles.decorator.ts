import { SetMetadata } from '@nestjs/common';

import { type Role } from '../users/user.types';

export const ROLES_KEY = 'roles';

/** Use alongside JwtAuthGuard + RolesGuard: @Roles('admin') restricts a route to admins. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

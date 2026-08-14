import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { type PublicUser } from '../users/user.types';
import { ROLES_KEY } from './roles.decorator';

/**
 * Must run after JwtAuthGuard (needs req.user already set). Routes
 * without @Roles(...) are allowed through unchanged — this only
 * restricts routes that explicitly opt in.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user: PublicUser = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user.role);
  }
}

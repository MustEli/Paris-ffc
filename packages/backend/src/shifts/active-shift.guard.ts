import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { type PublicUser } from '../users/user.types';
import { ShiftsService } from './shifts.service';

/**
 * Staff can't use Reception, Seller Stock, Put-Away, or Order Prep at
 * all — not even to browse — without an active shift; Attendance is the
 * one permanent exception (it's how a shift gets started in the first
 * place, so it's simply never guarded by this). A no-op for every other
 * role: Admin and Management have no shifts and use these same
 * controllers for their own admin/read-only purposes, so this only ever
 * checks anything when the caller is Staff. Must run after JwtAuthGuard
 * (needs req.user already set).
 */
@Injectable()
export class ActiveShiftGuard implements CanActivate {
  constructor(private readonly shiftsService: ShiftsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: PublicUser = request.user;
    if (user.role !== 'staff') {
      return true;
    }

    if (!(await this.shiftsService.hasActiveShift(user.id))) {
      throw new ForbiddenException('Start your shift before using this feature.');
    }
    return true;
  }
}

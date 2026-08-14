import { Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { type PublicUser } from '../users/user.types';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('start')
  start(@CurrentUser() user: PublicUser) {
    return this.shiftsService.startShift(user.id);
  }

  @Post('end')
  end(@CurrentUser() user: PublicUser) {
    return this.shiftsService.endShift(user.id);
  }

  @Get('status')
  status(@CurrentUser() user: PublicUser) {
    return this.shiftsService.getStatus(user.id);
  }
}

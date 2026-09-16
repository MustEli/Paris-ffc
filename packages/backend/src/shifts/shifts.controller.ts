import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { type PublicUser } from '../users/user.types';
import { StartBreakDto } from './dto/start-break.dto';
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

  /** Sent by the app every ~15 min while a shift is active and the app is open — see shifts.service.ts's HEARTBEAT_STALE_TOLERANCE_MS. */
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: PublicUser) {
    return this.shiftsService.heartbeat(user.id);
  }

  @Post('break/start')
  startBreak(@CurrentUser() user: PublicUser, @Body() dto: StartBreakDto) {
    return this.shiftsService.startBreak(user.id, dto.type);
  }

  @Post('break/end')
  endBreak(@CurrentUser() user: PublicUser) {
    return this.shiftsService.endBreak(user.id);
  }
}

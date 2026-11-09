import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { UsersModule } from '../users/users.module';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

@Module({
  imports: [AuthModule, UsersModule, ShiftsModule], // AuthModule needed for JwtStrategy; ShiftsModule for ActiveShiftGuard
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
  // Exported so OpenPoolModule can dispatch tasks from, and cascade-complete, a Reception.
  exports: [ReceptionsService],
})
export class ReceptionsModule {}

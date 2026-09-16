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
})
export class ReceptionsModule {}

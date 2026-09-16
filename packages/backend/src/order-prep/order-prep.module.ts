import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { UsersModule } from '../users/users.module';
import { OrderPrepController } from './order-prep.controller';
import { OrderPrepService } from './order-prep.service';

@Module({
  imports: [AuthModule, UsersModule, ShiftsModule], // AuthModule for consistency with sibling feature modules; ShiftsModule for ActiveShiftGuard
  controllers: [OrderPrepController],
  providers: [OrderPrepService],
})
export class OrderPrepModule {}

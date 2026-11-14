import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ReceptionTasksController } from './reception-tasks.controller';
import { ReceptionTasksService } from './reception-tasks.service';

@Module({
  imports: [AuthModule, ShiftsModule], // AuthModule for JwtStrategy; ShiftsModule for ActiveShiftGuard
  controllers: [ReceptionTasksController],
  providers: [ReceptionTasksService],
  // Exported so ReceptionsModule can complete a staff member's timer when they log a delivery.
  exports: [ReceptionTasksService],
})
export class ReceptionTasksModule {}

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { FloorTasksController } from './floor-tasks.controller';
import { FloorTasksService } from './floor-tasks.service';

@Module({
  imports: [AuthModule, ShiftsModule], // AuthModule for JwtStrategy; ShiftsModule for ActiveShiftGuard
  controllers: [FloorTasksController],
  providers: [FloorTasksService],
})
export class FloorTasksModule {}

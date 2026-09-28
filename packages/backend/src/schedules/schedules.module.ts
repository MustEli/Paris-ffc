import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { ScheduleAlertsService } from './schedule-alerts.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [AuthModule, UsersModule, RealtimeModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleAlertsService],
})
export class SchedulesModule {}

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FloorTasksModule } from '../floor-tasks/floor-tasks.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { UsersModule } from '../users/users.module';
import { DirectivesController } from './directives.controller';
import { DirectivesService } from './directives.service';

@Module({
  imports: [AuthModule, ShiftsModule, UsersModule, RealtimeModule, FloorTasksModule],
  controllers: [DirectivesController],
  providers: [DirectivesService],
})
export class DirectivesModule {}

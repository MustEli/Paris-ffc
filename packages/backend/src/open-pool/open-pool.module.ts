import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { OpenPoolController } from './open-pool.controller';
import { OpenPoolService } from './open-pool.service';

@Module({
  imports: [AuthModule, ShiftsModule, RealtimeModule],
  controllers: [OpenPoolController],
  providers: [OpenPoolService],
})
export class OpenPoolModule {}

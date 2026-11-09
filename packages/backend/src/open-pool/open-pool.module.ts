import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FloorTasksModule } from '../floor-tasks/floor-tasks.module';
import { ReceptionsModule } from '../receptions/receptions.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SellerStockModule } from '../seller-stock/seller-stock.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { OpenPoolController } from './open-pool.controller';
import { OpenPoolService } from './open-pool.service';

@Module({
  imports: [AuthModule, ShiftsModule, RealtimeModule, FloorTasksModule, ReceptionsModule, SellerStockModule],
  controllers: [OpenPoolController],
  providers: [OpenPoolService],
})
export class OpenPoolModule {}

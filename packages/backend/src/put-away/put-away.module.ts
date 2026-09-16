import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SellerStockModule } from '../seller-stock/seller-stock.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { UsersModule } from '../users/users.module';
import { PutAwayController } from './put-away.controller';
import { PutAwayService } from './put-away.service';

@Module({
  imports: [AuthModule, UsersModule, SellerStockModule, ShiftsModule], // AuthModule for JwtStrategy; ShiftsModule for ActiveShiftGuard
  controllers: [PutAwayController],
  providers: [PutAwayService],
})
export class PutAwayModule {}

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { SellerStockController } from './seller-stock.controller';
import { SellerStockService } from './seller-stock.service';

@Module({
  imports: [AuthModule, ShiftsModule], // AuthModule for JwtStrategy; ShiftsModule for ActiveShiftGuard
  controllers: [SellerStockController],
  providers: [SellerStockService],
  exports: [SellerStockService], // PutAwayModule calls into this directly
})
export class SellerStockModule {}

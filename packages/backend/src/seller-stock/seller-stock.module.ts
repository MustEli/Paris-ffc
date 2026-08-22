import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SellerStockController } from './seller-stock.controller';
import { SellerStockService } from './seller-stock.service';

@Module({
  imports: [AuthModule], // needed for JwtStrategy to be registered
  controllers: [SellerStockController],
  providers: [SellerStockService],
  exports: [SellerStockService], // PutAwayModule calls into this directly
})
export class SellerStockModule {}

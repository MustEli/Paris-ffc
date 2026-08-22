import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SellerStockModule } from '../seller-stock/seller-stock.module';
import { UsersModule } from '../users/users.module';
import { PutAwayController } from './put-away.controller';
import { PutAwayService } from './put-away.service';

@Module({
  imports: [AuthModule, UsersModule, SellerStockModule], // AuthModule needed for JwtStrategy to be registered
  controllers: [PutAwayController],
  providers: [PutAwayService],
})
export class PutAwayModule {}

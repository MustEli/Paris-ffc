import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PutAwayModule } from './put-away/put-away.module';
import { ReceptionsModule } from './receptions/receptions.module';
import { SellerStockModule } from './seller-stock/seller-stock.module';
import { ShiftsModule } from './shifts/shifts.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    ShiftsModule,
    ReceptionsModule,
    UploadsModule,
    SellerStockModule,
    PutAwayModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

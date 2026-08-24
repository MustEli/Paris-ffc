import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { OrderPrepModule } from './order-prep/order-prep.module';
import { PrismaModule } from './prisma/prisma.module';
import { PutAwayModule } from './put-away/put-away.module';
import { ReportsModule } from './reports/reports.module';
import { SheetsModule } from './sheets/sheets.module';
import { ReceptionsModule } from './receptions/receptions.module';
import { SellerStockModule } from './seller-stock/seller-stock.module';
import { ShiftsModule } from './shifts/shifts.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // e2e tests set NODE_ENV=test (see package.json's test:e2e script) so
    // they run against warehouse_hq_test instead of the dev database —
    // see test/utils/db.ts for the reset/reseed that keeps each test
    // isolated despite the DB now being real and persistent.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    PrismaModule,
    SheetsModule,
    UsersModule,
    AuthModule,
    ShiftsModule,
    ReceptionsModule,
    UploadsModule,
    SellerStockModule,
    PutAwayModule,
    OrderPrepModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

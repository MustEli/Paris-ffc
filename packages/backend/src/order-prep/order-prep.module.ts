import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { OrderPrepController } from './order-prep.controller';
import { OrderPrepService } from './order-prep.service';

@Module({
  imports: [AuthModule, UsersModule], // AuthModule for consistency with sibling feature modules — see UsersModule's own comment on why it's not strictly required
  controllers: [OrderPrepController],
  providers: [OrderPrepService],
})
export class OrderPrepModule {}

import { Module } from '@nestjs/common';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

// No AuthModule/UsersModule import needed — PrismaModule is @Global,
// and JwtStrategy registration doesn't need re-importing here (see
// UsersModule's comment on why).
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

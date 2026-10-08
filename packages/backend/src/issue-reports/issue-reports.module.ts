import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { IssueReportsController } from './issue-reports.controller';
import { IssueReportsService } from './issue-reports.service';

@Module({
  imports: [AuthModule, ShiftsModule, RealtimeModule], // AuthModule for JwtStrategy; ShiftsModule for ActiveShiftGuard; RealtimeModule for the Admin push
  controllers: [IssueReportsController],
  providers: [IssueReportsService],
})
export class IssueReportsModule {}

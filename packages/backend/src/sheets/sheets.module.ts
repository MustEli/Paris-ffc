import { Global, Module } from '@nestjs/common';

import { SheetsService } from './sheets.service';

// @Global so any feature service (ShiftsService, ReceptionsService, ...)
// can inject SheetsService without each one importing SheetsModule —
// same reasoning as PrismaModule.
@Global()
@Module({
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}

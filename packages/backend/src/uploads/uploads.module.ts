import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [AuthModule], // needed for JwtStrategy to be registered
  controllers: [UploadsController],
})
export class UploadsModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';
import { buildMulterOptions } from './uploads.storage';

@Module({
  imports: [
    AuthModule, // needed for JwtStrategy to be registered
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildMulterOptions(config),
    }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}

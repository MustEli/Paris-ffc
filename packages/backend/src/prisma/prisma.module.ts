import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * @Global so every feature module can inject PrismaService without each
 * one importing PrismaModule individually — same reasoning as why
 * AuthModule's JwtStrategy registration doesn't need re-importing
 * everywhere (see UsersModule's comment).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

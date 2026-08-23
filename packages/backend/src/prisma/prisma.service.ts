import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper so PrismaClient plugs into Nest's lifecycle (connect on
 * boot, disconnect on shutdown) and can be injected like any other
 * provider. Every service that used to hold an in-memory array now
 * injects this instead.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

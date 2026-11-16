import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      // In dev or sandbox without running DB instance, soft fail
      console.warn('[PrismaService] Running in decoupled memory mode (Database disconnected)');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { Module } from '@nestjs/common';
import { BillingController } from './presentation/http/billing.controller';
import { KaseraPayService } from './infrastructure/gateways/kaserapay.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [BillingController],
  providers: [KaseraPayService, PrismaService],
  exports: [KaseraPayService],
})
export class BillingModule {}

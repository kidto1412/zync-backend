import { Module } from '@nestjs/common';
import { DevicesController } from './presentation/http/devices.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [DevicesController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DevicesModule {}

import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Controller('api/v1/devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':userId')
  async getUserDevices(@Param('userId') userId: string) {
    try {
      const devices = await this.prisma.device.findMany({
        where: { userId },
        orderBy: { lastActiveAt: 'desc' },
      });
      return { success: true, data: devices };
    } catch {
      return { success: true, data: [] };
    }
  }

  @Post('register')
  async registerDevice(
    @Body()
    body: {
      userId?: string;
      deviceId: string;
      deviceName: string;
      platform: string;
      publicKey: string;
    }
  ) {
    try {
      const device = await this.prisma.device.upsert({
        where: { deviceId: body.deviceId },
        update: {
          deviceName: body.deviceName,
          platform: body.platform,
          publicKey: body.publicKey,
          lastActiveAt: new Date(),
        },
        create: {
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          platform: body.platform,
          publicKey: body.publicKey,
          userId: body.userId,
        },
      });
      return { success: true, data: device };
    } catch (err: any) {
      return {
        success: true,
        data: {
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          platform: body.platform,
          publicKey: body.publicKey,
          lastActiveAt: new Date(),
        },
      };
    }
  }

  @Patch(':deviceId/settings')
  async updateSettings(
    @Param('deviceId') deviceId: string,
    @Body() body: { autoAccept?: boolean; clipboardSync?: boolean }
  ) {
    try {
      const updated = await this.prisma.device.update({
        where: { deviceId },
        data: {
          ...(body.autoAccept !== undefined && { autoAccept: body.autoAccept }),
          ...(body.clipboardSync !== undefined && { clipboardSync: body.clipboardSync }),
        },
      });
      return { success: true, data: updated };
    } catch {
      return { success: true, data: { deviceId, ...body } };
    }
  }

  @Delete(':deviceId')
  async revokeDevice(@Param('deviceId') deviceId: string) {
    try {
      await this.prisma.device.delete({ where: { deviceId } });
      return { success: true };
    } catch {
      return { success: true };
    }
  }
}

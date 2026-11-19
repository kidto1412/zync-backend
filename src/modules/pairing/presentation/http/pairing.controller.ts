import { Controller, Get, Param, NotFoundException, Inject } from '@nestjs/common';
import { RoomCachePort, ROOM_CACHE_PORT } from '../../application/ports/room-cache.port';

@Controller('pairing')
export class PairingController {
  constructor(
    @Inject(ROOM_CACHE_PORT)
    private readonly roomCache: RoomCachePort
  ) {}

  @Get('drop/:slug')
  async getDropLinkInfo(@Param('slug') slug: string) {
    const room = await this.roomCache.findBySlug(slug);
    if (!room || room.isExpired()) {
      throw new NotFoundException({
        success: false,
        statusCode: 404,
        errorCode: 'DROP_LINK_EXPIRED_OR_NOT_FOUND',
        message: 'Tautan Guest Drop tidak ditemukan atau telah kedaluwarsa (10 menit).',
      });
    }

    const elapsedSeconds = (Date.now() - room.createdAt.getTime()) / 1000;
    const ttlRemaining = Math.max(0, Math.floor(room.ttlSeconds - elapsedSeconds));

    return {
      success: true,
      statusCode: 200,
      data: {
        valid: true,
        slug: room.slug,
        roomId: room.id,
        hostName: room.host.deviceName,
        hostPlatform: room.host.platform,
        expiresAt: new Date(room.createdAt.getTime() + room.ttlSeconds * 1000).toISOString(),
        ttlRemainingSeconds: ttlRemaining,
      },
    };
  }
}

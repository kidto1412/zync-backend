import { Injectable, Inject } from '@nestjs/common';
import { Room, Participant } from '../../domain/entities/room.entity';
import { RoomCachePort, ROOM_CACHE_PORT } from '../ports/room-cache.port';

@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_CACHE_PORT)
    private readonly roomCache: RoomCachePort
  ) {}

  async execute(
    host: Participant,
    isPro = false
  ): Promise<{ roomId: string; pin: string; qrPayload: string; maxPeers: number }> {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const maxPeers = isPro ? 4 : 1; // Pro: up to 5 devices (host + 4 peers)

    const room = new Room(roomId, pin, host, null, new Date(), 300, maxPeers);
    await this.roomCache.save(room);

    const qrPayload = JSON.stringify({
      roomId,
      pin,
      hostPublicKey: host.publicKey,
      isPro,
    });

    return { roomId, pin, qrPayload, maxPeers };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { Room, Participant } from '../../domain/entities/room.entity';
import { RoomCachePort, ROOM_CACHE_PORT } from '../ports/room-cache.port';
import { RoomNotFoundException, RoomFullException } from '../../../../shared/domain/exceptions/app.exception';

@Injectable()
export class JoinRoomUseCase {
  constructor(
    @Inject(ROOM_CACHE_PORT)
    private readonly roomCache: RoomCachePort
  ) {}

  async execute(pin: string, peer: Participant): Promise<{ room: Room; host: Participant }> {
    const room = await this.roomCache.findByPin(pin);
    if (!room || room.isExpired()) {
      throw new RoomNotFoundException(pin);
    }

    if (!room.canJoin()) {
      throw new RoomFullException();
    }

    room.addPeer(peer);
    await this.roomCache.save(room);

    return {
      room,
      host: room.host,
    };
  }
}

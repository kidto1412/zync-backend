import { Injectable, Logger } from '@nestjs/common';
import { Room } from '../../domain/entities/room.entity';
import { RoomCachePort } from '../../application/ports/room-cache.port';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';

@Injectable()
export class RedisRoomCacheService implements RoomCachePort {
  private readonly logger = new Logger(RedisRoomCacheService.name);
  private readonly memoryRoomsById = new Map<string, Room>();
  private readonly memoryRoomsByPin = new Map<string, string>();

  constructor(private readonly redisService: RedisService) {}

  private getRoomKey(roomId: string): string {
    return `zynq:room:${roomId}`;
  }

  private getPinKey(pin: string): string {
    return `zynq:pin:${pin}`;
  }

  async save(room: Room): Promise<void> {
    const serialized = JSON.stringify({
      id: room.id,
      pin: room.pin,
      host: room.host,
      peer: room.peer,
      peers: room.peers,
      maxPeers: room.maxPeers,
      createdAt: room.createdAt.toISOString(),
      ttlSeconds: room.ttlSeconds,
    });

    // Save in memory
    this.memoryRoomsById.set(room.id, room);
    this.memoryRoomsByPin.set(room.pin, room.id);

    // Save in Redis with TTL
    try {
      const client = this.redisService.getClient();
      if (client) {
        await client
          .multi()
          .set(this.getRoomKey(room.id), serialized, 'EX', room.ttlSeconds)
          .set(this.getPinKey(room.pin), room.id, 'EX', room.ttlSeconds)
          .exec();
      }
    } catch (err: any) {
      this.logger.warn(`Redis save failed, relying on in-memory cache: ${err.message}`);
    }
  }

  async findByPin(pin: string): Promise<Room | null> {
    try {
      const client = this.redisService.getClient();
      if (client) {
        const roomId = await client.get(this.getPinKey(pin));
        if (roomId) {
          return this.findById(roomId);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis findByPin failed, checking in-memory cache: ${err.message}`);
    }

    const memoryRoomId = this.memoryRoomsByPin.get(pin);
    if (!memoryRoomId) return null;
    return this.findById(memoryRoomId);
  }

  async findById(roomId: string): Promise<Room | null> {
    try {
      const client = this.redisService.getClient();
      if (client) {
        const raw = await client.get(this.getRoomKey(roomId));
        if (raw) {
          const parsed = JSON.parse(raw);
          const room = new Room(
            parsed.id,
            parsed.pin,
            parsed.host,
            parsed.peers || (parsed.peer ? [parsed.peer] : []),
            new Date(parsed.createdAt),
            parsed.ttlSeconds,
            parsed.maxPeers || 1
          );
          if (room.isExpired()) {
            await this.delete(roomId);
            return null;
          }
          return room;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis findById failed, checking in-memory cache: ${err.message}`);
    }

    const memoryRoom = this.memoryRoomsById.get(roomId);
    if (!memoryRoom) return null;
    if (memoryRoom.isExpired()) {
      await this.delete(roomId);
      return null;
    }
    return memoryRoom;
  }

  async delete(roomId: string): Promise<void> {
    const memoryRoom = this.memoryRoomsById.get(roomId);
    if (memoryRoom) {
      this.memoryRoomsByPin.delete(memoryRoom.pin);
      this.memoryRoomsById.delete(roomId);
    }

    try {
      const client = this.redisService.getClient();
      if (client && this.redisService.isConnected()) {
        const raw = await client.get(this.getRoomKey(roomId));
        if (raw) {
          const parsed = JSON.parse(raw);
          await client
            .multi()
            .del(this.getRoomKey(roomId))
            .del(this.getPinKey(parsed.pin))
            .exec();
        } else {
          await client.del(this.getRoomKey(roomId));
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis delete failed: ${err.message}`);
    }
  }
}

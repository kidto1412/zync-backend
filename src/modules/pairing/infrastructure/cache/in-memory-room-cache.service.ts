import { Injectable } from '@nestjs/common';
import { Room } from '../../domain/entities/room.entity';
import { RoomCachePort } from '../../application/ports/room-cache.port';

@Injectable()
export class InMemoryRoomCacheService implements RoomCachePort {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomsByPin = new Map<string, string>(); // PIN -> roomId

  async save(room: Room): Promise<void> {
    this.roomsById.set(room.id, room);
    this.roomsByPin.set(room.pin, room.id);
  }

  async findByPin(pin: string): Promise<Room | null> {
    const roomId = this.roomsByPin.get(pin);
    if (!roomId) return null;
    return this.findById(roomId);
  }

  async findById(roomId: string): Promise<Room | null> {
    const room = this.roomsById.get(roomId);
    if (!room) return null;
    if (room.isExpired()) {
      await this.delete(roomId);
      return null;
    }
    return room;
  }

  async delete(roomId: string): Promise<void> {
    const room = this.roomsById.get(roomId);
    if (room) {
      this.roomsByPin.delete(room.pin);
      this.roomsById.delete(roomId);
    }
  }
}

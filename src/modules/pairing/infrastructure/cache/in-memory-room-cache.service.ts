import { Injectable } from '@nestjs/common';
import { Room } from '../../domain/entities/room.entity';
import { RoomCachePort } from '../../application/ports/room-cache.port';

@Injectable()
export class InMemoryRoomCacheService implements RoomCachePort {
  private readonly roomsById = new Map<string, Room>();
  private readonly roomsByPin = new Map<string, string>(); // PIN -> roomId
  private readonly roomsBySlug = new Map<string, string>(); // slug -> roomId

  async save(room: Room): Promise<void> {
    this.roomsById.set(room.id, room);
    this.roomsByPin.set(room.pin, room.id);
    if (room.slug) {
      this.roomsBySlug.set(room.slug.toLowerCase(), room.id);
    }
  }

  async findByPin(pin: string): Promise<Room | null> {
    const roomId = this.roomsByPin.get(pin);
    if (!roomId) return null;
    return this.findById(roomId);
  }

  async findBySlug(slug: string): Promise<Room | null> {
    const roomId = this.roomsBySlug.get(slug.toLowerCase());
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
      if (room.slug) {
        this.roomsBySlug.delete(room.slug.toLowerCase());
      }
      this.roomsById.delete(roomId);
    }
  }
}

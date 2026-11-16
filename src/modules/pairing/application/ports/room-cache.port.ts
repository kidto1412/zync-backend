import { Room } from '../../domain/entities/room.entity';

export interface RoomCachePort {
  save(room: Room): Promise<void>;
  findByPin(pin: string): Promise<Room | null>;
  findById(roomId: string): Promise<Room | null>;
  delete(roomId: string): Promise<void>;
}

export const ROOM_CACHE_PORT = Symbol('RoomCachePort');

import { Module } from '@nestjs/common';
import { PairingGateway } from './presentation/ws/pairing.gateway';
import { CreateRoomUseCase } from './application/use-cases/create-room.use-case';
import { JoinRoomUseCase } from './application/use-cases/join-room.use-case';
import { ROOM_CACHE_PORT } from './application/ports/room-cache.port';
import { InMemoryRoomCacheService } from './infrastructure/cache/in-memory-room-cache.service';

@Module({
  providers: [
    PairingGateway,
    CreateRoomUseCase,
    JoinRoomUseCase,
    {
      provide: ROOM_CACHE_PORT,
      useClass: InMemoryRoomCacheService,
    },
  ],
  exports: [CreateRoomUseCase, JoinRoomUseCase],
})
export class PairingModule {}

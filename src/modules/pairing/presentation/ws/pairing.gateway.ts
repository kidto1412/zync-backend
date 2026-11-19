import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject } from '@nestjs/common';
import { CreateRoomUseCase } from '../../application/use-cases/create-room.use-case';
import { JoinRoomUseCase } from '../../application/use-cases/join-room.use-case';
import { RoomCachePort, ROOM_CACHE_PORT } from '../../application/ports/room-cache.port';
import { Room, Participant } from '../../domain/entities/room.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  namespace: '/signaling',
})
export class PairingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly joinRoomUseCase: JoinRoomUseCase,
    @Inject(ROOM_CACHE_PORT)
    private readonly roomCache: RoomCachePort
  ) {}

  handleConnection(client: Socket) {
    console.log(`[Signaling] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Signaling] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('room:create')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deviceName?: string; platform?: string; publicKey?: string; isPro?: boolean }
  ) {
    const participant = {
      clientId: client.id,
      deviceName: payload?.deviceName || 'Unknown Device',
      platform: payload?.platform || 'unknown',
      publicKey: payload?.publicKey || '',
    };

    const result = await this.createRoomUseCase.execute(participant, Boolean(payload?.isPro));
    client.join(result.roomId);

    console.log(
      `[Signaling] Room created: ${result.roomId} | PIN: ${result.pin} | Host: ${participant.deviceName} (${client.id}) | MaxPeers: ${result.maxPeers}`
    );

    // Emit event directly to socket
    client.emit('room:created', result);

    return {
      event: 'room:created',
      data: result,
    };
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { pin: string; deviceName?: string; platform?: string; publicKey?: string }
  ) {
    const participant = {
      clientId: client.id,
      deviceName: payload?.deviceName || 'Peer Device',
      platform: payload?.platform || 'unknown',
      publicKey: payload?.publicKey || '',
    };

    try {
      const result = await this.joinRoomUseCase.execute(payload.pin, participant);
      client.join(result.room.id);

      console.log(
        `[Signaling] Peer ${participant.deviceName} (${client.id}) joined room ${result.room.id} hosted by ${result.host.deviceName}. Total peers: ${result.room.peers.length}/${result.room.maxPeers}`
      );

      // Notify host and other peers that a new peer has entered room (Mesh broadcast)
      client.to(result.room.id).emit('room:peer-joined', {
        peer: participant,
        peers: result.room.peers,
        roomId: result.room.id,
      });

      const joinedPayload = {
        roomId: result.room.id,
        host: result.host,
        peers: result.room.peers,
      };

      // Emit event directly to socket
      client.emit('room:joined', joinedPayload);

      return {
        event: 'room:joined',
        data: joinedPayload,
      };
    } catch (err: any) {
      console.warn(`[Signaling] Failed to join room with PIN ${payload.pin}:`, err.message);
      client.emit('room:error', { message: err.message });
      return {
        event: 'room:error',
        data: {
          message: err.message,
        },
      };
    }
  }

  @SubscribeMessage('drop:create')
  async handleCreateDropLink(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      deviceName?: string;
      platform?: string;
      publicKey?: string;
      slug?: string;
      isPro?: boolean;
    }
  ) {
    if (!payload?.isPro) {
      const msg = 'Guest Drop Link adalah fitur eksklusif akun Pro Lifetime.';
      client.emit('drop:error', { message: msg });
      return { event: 'drop:error', data: { message: msg } };
    }

    const rawSlug = payload.slug
      ? payload.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 32)
      : '';
    const finalSlug = rawSlug || `drop-${Math.random().toString(36).substring(2, 7)}`;

    // Check if slug is currently occupied by active room
    let resolvedSlug = finalSlug;
    const existing = await this.roomCache.findBySlug(finalSlug);
    if (existing && !existing.isExpired()) {
      resolvedSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 5)}`;
    }

    const roomId = `drop-${resolvedSlug}-${Date.now()}`;
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    const hostParticipant: Participant = {
      clientId: client.id,
      deviceName: payload?.deviceName || 'Pro Host',
      platform: payload?.platform || 'desktop',
      publicKey: payload?.publicKey || 'PRO-DROP-KEY',
    };

    // 10 minutes TTL (600 seconds) as defined in PRD Section 9.1 sub 7
    const room = new Room(roomId, pin, hostParticipant, null, new Date(), 600, 1, resolvedSlug, true);
    await this.roomCache.save(room);
    client.join(roomId);

    console.log(
      `[Signaling] Guest Drop Link created: /drop/${resolvedSlug} (TTL 10 mins) by ${hostParticipant.deviceName} (${client.id})`
    );

    const result = {
      roomId,
      slug: resolvedSlug,
      dropUrl: `/drop/${resolvedSlug}`,
      expiresAt: new Date(room.createdAt.getTime() + 600 * 1000).toISOString(),
      ttlSeconds: 600,
    };

    client.emit('drop:created', result);
    return {
      event: 'drop:created',
      data: result,
    };
  }

  @SubscribeMessage('drop:join')
  async handleJoinDropLink(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { slug: string; deviceName?: string; platform?: string }
  ) {
    if (!payload?.slug) {
      client.emit('drop:error', { message: 'Slug tautan Guest Drop wajib diisi.' });
      return;
    }

    const room = await this.roomCache.findBySlug(payload.slug);
    if (!room || room.isExpired()) {
      console.warn(`[Signaling] Drop link not found or expired: ${payload.slug}`);
      client.emit('drop:error', {
        message: 'Tautan Guest Drop tidak ditemukan atau telah kedaluwarsa (10 menit).',
      });
      return;
    }

    const guestParticipant: Participant = {
      clientId: client.id,
      deviceName: payload?.deviceName || 'Guest Client',
      platform: payload?.platform || 'web',
      publicKey: 'GUEST-DROP-TOKEN',
    };

    room.addPeer(guestParticipant);
    await this.roomCache.save(room);
    client.join(room.id);

    console.log(
      `[Signaling] Guest ${guestParticipant.deviceName} (${client.id}) joined drop room ${room.id} (/drop/${payload.slug}) hosted by ${room.host.deviceName}`
    );

    // Notify host that guest has entered the drop room to stream files
    client.to(room.id).emit('room:peer-joined', {
      peer: guestParticipant,
      peers: room.peers,
      roomId: room.id,
      isDropLink: true,
      slug: payload.slug,
    });

    const joinedPayload = {
      roomId: room.id,
      host: room.host,
      slug: payload.slug,
      expiresAt: new Date(room.createdAt.getTime() + room.ttlSeconds * 1000).toISOString(),
    };

    client.emit('drop:joined', joinedPayload);
    return {
      event: 'drop:joined',
      data: joinedPayload,
    };
  }

  @SubscribeMessage('webrtc:offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { targetClientId: string; sdp: any }
  ) {
    this.server.to(payload.targetClientId).emit('webrtc:offer', {
      senderClientId: client.id,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('webrtc:answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { targetClientId: string; sdp: any }
  ) {
    this.server.to(payload.targetClientId).emit('webrtc:answer', {
      senderClientId: client.id,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { targetClientId: string; candidate: any }
  ) {
    this.server.to(payload.targetClientId).emit('webrtc:ice-candidate', {
      senderClientId: client.id,
      candidate: payload.candidate,
    });
  }
}

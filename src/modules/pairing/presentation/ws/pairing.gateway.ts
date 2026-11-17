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
import { CreateRoomUseCase } from '../../application/use-cases/create-room.use-case';
import { JoinRoomUseCase } from '../../application/use-cases/join-room.use-case';

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
    private readonly joinRoomUseCase: JoinRoomUseCase
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

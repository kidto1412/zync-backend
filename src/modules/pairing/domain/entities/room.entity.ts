export interface Participant {
  clientId: string;
  deviceName: string;
  platform: string;
  publicKey: string;
}

export class Room {
  constructor(
    public readonly id: string,
    public readonly pin: string,
    public readonly host: Participant,
    public peer: Participant | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly ttlSeconds: number = 300 // 5 minutes
  ) {}

  canJoin(): boolean {
    return this.peer === null && !this.isExpired();
  }

  addPeer(participant: Participant): void {
    if (!this.canJoin()) {
      throw new Error('Room is full or expired');
    }
    this.peer = participant;
  }

  isExpired(): boolean {
    const elapsed = (Date.now() - this.createdAt.getTime()) / 1000;
    return elapsed > this.ttlSeconds;
  }
}

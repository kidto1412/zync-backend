export interface Participant {
  clientId: string;
  deviceName: string;
  platform: string;
  publicKey: string;
}

export class Room {
  public peers: Participant[] = [];

  constructor(
    public readonly id: string,
    public readonly pin: string,
    public readonly host: Participant,
    peerOrPeers: Participant | Participant[] | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly ttlSeconds: number = 300, // 5 minutes default
    public maxPeers: number = 1, // Free Tier: 1 peer (2 devices total), Pro Tier: 4 peers (5 devices Group Beam)
    public readonly slug?: string,
    public readonly isDropLink: boolean = false
  ) {
    if (Array.isArray(peerOrPeers)) {
      this.peers = peerOrPeers;
    } else if (peerOrPeers) {
      this.peers = [peerOrPeers];
    }
  }

  get peer(): Participant | null {
    return this.peers[0] || null;
  }

  set peer(p: Participant | null) {
    if (p) {
      this.peers = [p];
    } else {
      this.peers = [];
    }
  }

  canJoin(): boolean {
    return this.peers.length < this.maxPeers && !this.isExpired();
  }

  addPeer(participant: Participant): void {
    const existingIdx = this.peers.findIndex((p) => p.clientId === participant.clientId);
    if (existingIdx >= 0) {
      this.peers[existingIdx] = participant;
      return;
    }

    if (!this.canJoin()) {
      throw new Error(`Room sudah penuh (Maksimal ${this.maxPeers + 1} perangkat dalam sesi ini)`);
    }

    this.peers.push(participant);
  }

  isExpired(): boolean {
    const elapsed = (Date.now() - this.createdAt.getTime()) / 1000;
    return elapsed > this.ttlSeconds;
  }
}

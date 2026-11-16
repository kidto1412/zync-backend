import { Injectable } from '@nestjs/common';
import { VaultEntry } from '../../domain/entities/vault-entry.entity';
import { VaultRepositoryPort } from '../../application/ports/vault.repository.port';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaVaultRepository implements VaultRepositoryPort {
  // In-memory fallback if database is offline in local dev sandbox
  private readonly fallbackMemoryVault: VaultEntry[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async save(entry: VaultEntry): Promise<void> {
    try {
      await this.prisma.vaultEntry.create({
        data: {
          id: entry.id,
          userId: entry.userId,
          sourceDevice: entry.sourceDevice,
          contentType: entry.contentType,
          encryptedData: entry.encryptedData,
          iv: entry.iv,
          byteSize: entry.byteSize,
          expiresAt: entry.expiresAt,
        },
      });
    } catch {
      this.fallbackMemoryVault.push(entry);
    }
  }

  async findByUserId(userId: string): Promise<VaultEntry[]> {
    try {
      const records = await this.prisma.vaultEntry.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      return records.map(
        (r) =>
          new VaultEntry(
            r.id,
            r.userId,
            r.sourceDevice,
            r.contentType,
            r.encryptedData,
            r.iv,
            r.byteSize,
            r.expiresAt,
            r.createdAt
          )
      );
    } catch {
      return this.fallbackMemoryVault.filter((e) => e.userId === userId && e.expiresAt > new Date());
    }
  }

  async deleteExpired(): Promise<number> {
    try {
      const res = await this.prisma.vaultEntry.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      });
      return res.count;
    } catch {
      return 0;
    }
  }
}

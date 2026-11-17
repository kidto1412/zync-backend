import { Controller, Post, Get, Delete, Body, Param, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { VaultEntry } from '../../domain/entities/vault-entry.entity';
import { VaultRepositoryPort, VAULT_REPOSITORY_PORT } from '../../application/ports/vault.repository.port';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Controller('api/v1/vault')
export class VaultController {
  constructor(
    @Inject(VAULT_REPOSITORY_PORT)
    private readonly vaultRepo: VaultRepositoryPort,
    private readonly prisma: PrismaService
  ) {}

  @Post('sync')
  async syncEntry(
    @Body()
    body: {
      userId: string;
      sourceDevice: string;
      contentType: string;
      encryptedData: string;
      iv: string;
      byteSize: number;
    }
  ) {
    // Enforce PRD Keamanan Clipboard: Free Tier operates in RAM-only mode
    if (body.userId && body.userId !== 'anonymous-user' && body.userId !== 'default-user') {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: body.userId },
        });

        if (user && user.plan !== 'PRO_LIFETIME') {
          throw new HttpException(
            {
              success: false,
              message:
                'Mode RAM-Only aktif pada Free Tier. Riwayat clipboard 30-Day Zero-Knowledge Vault adalah fitur eksklusif ZYNQ Pro Lifetime.',
            },
            HttpStatus.FORBIDDEN
          );
        }
      } catch (err: any) {
        if (err instanceof HttpException) throw err;
      }
    }

    const entryId = `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days TTL (Pro Tier)

    const entry = new VaultEntry(
      entryId,
      body.userId || 'anonymous-user',
      body.sourceDevice || 'Unknown Device',
      body.contentType || 'text/plain',
      body.encryptedData,
      body.iv,
      body.byteSize || 0,
      expiresAt
    );

    await this.vaultRepo.save(entry);

    return {
      success: true,
      data: {
        id: entry.id,
        expiresAt: entry.expiresAt,
      },
    };
  }

  @Get(':userId')
  async getVaultHistory(@Param('userId') userId: string) {
    const entries = await this.vaultRepo.findByUserId(userId);
    return {
      success: true,
      data: entries,
    };
  }

  // Instant Panic Purge - hard-delete all entries for this user
  @Delete('purge/:userId')
  async purgeUserVault(@Param('userId') userId: string) {
    const count = await this.vaultRepo.purgeAllByUserId(userId);
    return {
      success: true,
      message: `Instant Panic Purge berhasil. ${count} rekaman clipboard dihapus permanen.`,
      purgedCount: count,
    };
  }

  @Post('purge/:userId')
  async purgeUserVaultPost(@Param('userId') userId: string) {
    const count = await this.vaultRepo.purgeAllByUserId(userId);
    return {
      success: true,
      message: `Instant Panic Purge berhasil. ${count} rekaman clipboard dihapus permanen.`,
      purgedCount: count,
    };
  }

  // Ghost Auto-Purge Worker Endpoint (also triggered via cron)
  @Post('ghost-purge')
  async triggerGhostPurge() {
    const count = await this.vaultRepo.deleteExpired();
    return {
      success: true,
      message: `Ghost Auto-Purge selesai. ${count} entri kedaluwarsa dibersihkan.`,
      deletedCount: count,
    };
  }
}

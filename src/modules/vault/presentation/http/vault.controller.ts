import { Controller, Post, Get, Body, Param, Inject } from '@nestjs/common';
import { VaultEntry } from '../../domain/entities/vault-entry.entity';
import { VaultRepositoryPort, VAULT_REPOSITORY_PORT } from '../../application/ports/vault.repository.port';

@Controller('api/v1/vault')
export class VaultController {
  constructor(
    @Inject(VAULT_REPOSITORY_PORT)
    private readonly vaultRepo: VaultRepositoryPort
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
}

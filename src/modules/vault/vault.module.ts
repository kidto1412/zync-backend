import { Module } from '@nestjs/common';
import { VaultController } from './presentation/http/vault.controller';
import { VAULT_REPOSITORY_PORT } from './application/ports/vault.repository.port';
import { PrismaVaultRepository } from './infrastructure/persistence/prisma-vault.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [VaultController],
  providers: [
    PrismaService,
    {
      provide: VAULT_REPOSITORY_PORT,
      useClass: PrismaVaultRepository,
    },
  ],
  exports: [VAULT_REPOSITORY_PORT],
})
export class VaultModule {}

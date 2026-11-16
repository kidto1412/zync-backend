import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { PairingModule } from './modules/pairing/pairing.module';
import { VaultModule } from './modules/vault/vault.module';
import { BillingModule } from './modules/billing/billing.module';
import { DevicesModule } from './modules/devices/devices.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';

@Module({
  imports: [RedisModule, AuthModule, PairingModule, VaultModule, BillingModule, DevicesModule],
})
export class AppModule {}

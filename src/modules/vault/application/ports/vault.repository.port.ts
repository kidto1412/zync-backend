import { VaultEntry } from '../../domain/entities/vault-entry.entity';

export interface VaultRepositoryPort {
  save(entry: VaultEntry): Promise<void>;
  findByUserId(userId: string): Promise<VaultEntry[]>;
  deleteExpired(): Promise<number>;
}

export const VAULT_REPOSITORY_PORT = Symbol('VaultRepositoryPort');

import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PayloadEncryptionService {
  private readonly logger = new Logger(PayloadEncryptionService.name);
  private readonly derivedKey: Buffer;

  constructor() {
    const secret = process.env.SESSION_SECRET || 'unibeam_session_ephemeral_salt_2026';
    this.derivedKey = crypto.createHash('sha256').update(secret).digest();
  }

  decryptAuthPayload<T>(body: any): T {
    // 1. If payload is encrypted via AES-256-GCM
    if (body?.encryptedData && body?.iv) {
      try {
        const combined = Buffer.from(body.encryptedData, 'base64');
        const iv = Buffer.from(body.iv, 'base64');

        if (combined.length < 16) {
          throw new Error('Ciphertext too short');
        }

        // Last 16 bytes is the GCM authentication tag
        const tag = combined.subarray(combined.length - 16);
        const ciphertext = combined.subarray(0, combined.length - 16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', this.derivedKey, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);

        const parsed = JSON.parse(decrypted.toString('utf8'));

        // Anti-replay protection: verify timestamp within 5 minutes (300,000ms)
        if (parsed.timestamp) {
          const age = Math.abs(Date.now() - parsed.timestamp);
          if (age > 300_000) {
            this.logger.warn(`Rejected replayed auth payload. Age: ${age}ms`);
            throw new UnauthorizedException('Payload autentikasi telah kadaluarsa');
          }
        }

        return parsed as T;
      } catch (err: any) {
        this.logger.error(`Failed to decrypt auth payload: ${err.message}`);
        throw new BadRequestException('Payload autentikasi terenkripsi tidak valid');
      }
    }

    // 2. Fallback / Plain payload (if client not yet updated)
    if (body?.email && body?.password) {
      return body as T;
    }

    throw new BadRequestException('Format payload autentikasi tidak valid');
  }
}

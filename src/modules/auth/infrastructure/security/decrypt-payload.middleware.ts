import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PayloadEncryptionService } from './payload-encryption.service';

@Injectable()
export class DecryptPayloadMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DecryptPayloadMiddleware.name);

  constructor(private readonly payloadEncryptionService: PayloadEncryptionService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body && req.body.encryptedData && req.body.iv) {
      try {
        const decrypted = this.payloadEncryptionService.decryptAuthPayload<any>(req.body);
        req.body = decrypted;
      } catch (err: any) {
        this.logger.warn(`Failed to decrypt request body in middleware: ${err.message}`);
      }
    }
    next();
  }
}

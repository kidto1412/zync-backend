import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { AuthController } from './presentation/http/auth.controller';
import { RegisterUseCase, LoginUseCase } from './application/use-cases/auth.use-cases';
import { USER_REPOSITORY_PORT } from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { HashService, JwtService } from './infrastructure/security/hash.service';
import { PayloadEncryptionService } from './infrastructure/security/payload-encryption.service';
import { DecryptPayloadMiddleware } from './infrastructure/security/decrypt-payload.middleware';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    HashService,
    JwtService,
    PayloadEncryptionService,
    DecryptPayloadMiddleware,
    RegisterUseCase,
    LoginUseCase,
    {
      provide: USER_REPOSITORY_PORT,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [JwtService, PayloadEncryptionService, USER_REPOSITORY_PORT],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DecryptPayloadMiddleware)
      .forRoutes(
        { path: 'api/v1/auth/login', method: RequestMethod.POST },
        { path: 'api/v1/auth/register', method: RequestMethod.POST }
      );
  }
}

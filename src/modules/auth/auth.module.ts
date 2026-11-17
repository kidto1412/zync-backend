import { Module } from '@nestjs/common';
import { AuthController } from './presentation/http/auth.controller';
import { RegisterUseCase, LoginUseCase } from './application/use-cases/auth.use-cases';
import { USER_REPOSITORY_PORT } from './application/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { HashService, JwtService } from './infrastructure/security/hash.service';
import { PayloadEncryptionService } from './infrastructure/security/payload-encryption.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    HashService,
    JwtService,
    PayloadEncryptionService,
    RegisterUseCase,
    LoginUseCase,
    {
      provide: USER_REPOSITORY_PORT,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [JwtService, PayloadEncryptionService, USER_REPOSITORY_PORT],
})
export class AuthModule {}

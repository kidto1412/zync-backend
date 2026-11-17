import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { RegisterUseCase, LoginUseCase } from '../../application/use-cases/auth.use-cases';
import { JwtService } from '../../infrastructure/security/hash.service';
import { PayloadEncryptionService } from '../../infrastructure/security/payload-encryption.service';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '../../application/ports/user.repository.port';
import { Inject } from '@nestjs/common';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly jwtService: JwtService,
    private readonly payloadEncryptionService: PayloadEncryptionService,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const payload =
      body?.email && body?.password
        ? body
        : this.payloadEncryptionService.decryptAuthPayload<{
            email: string;
            password: string;
            name?: string;
          }>(body);

    if (!payload.email || !payload.password) {
      throw new UnauthorizedException('Email dan password wajib diisi');
    }
    const result = await this.registerUseCase.execute(payload);
    return {
      success: true,
      data: result,
    };
  }

  @Post('login')
  async login(@Body() body: any) {
    const payload =
      body?.email && body?.password
        ? body
        : this.payloadEncryptionService.decryptAuthPayload<{
            email: string;
            password: string;
          }>(body);

    if (!payload.email || !payload.password) {
      throw new UnauthorizedException('Email dan password wajib diisi');
    }
    const result = await this.loginUseCase.execute(payload);
    return {
      success: true,
      data: result,
    };
  }

  @Get('me')
  async getProfile(@Headers('authorization') authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token tidak disediakan');
    }

    const token = authHeader.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    if (!decoded) {
      throw new UnauthorizedException('Token kadaluarsa atau tidak valid');
    }

    const user = await this.userRepo.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        licenseKey: user.licenseKey,
      },
    };
  }
}

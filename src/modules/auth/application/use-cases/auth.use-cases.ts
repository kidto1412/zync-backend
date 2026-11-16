import { Injectable, Inject, ConflictException, UnauthorizedException } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '../ports/user.repository.port';
import { HashService, JwtService } from '../../infrastructure/security/hash.service';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: { email: string; password: string; name?: string }) {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email sudah terdaftar. Silakan login.');
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = this.hashService.hashPassword(dto.password);

    const newUser = new User(userId, dto.email, passwordHash, dto.name, 'FREE');
    const saved = await this.userRepo.create(newUser);

    const token = this.jwtService.sign({
      userId: saved.id,
      email: saved.email,
      plan: saved.plan,
    });

    return {
      token,
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        plan: saved.plan,
        licenseKey: saved.licenseKey,
      },
    };
  }
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService
  ) {}

  async execute(dto: { email: string; password: string }) {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email atau password tidak valid');
    }

    const isValid = this.hashService.comparePassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Email atau password tidak valid');
    }

    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
      plan: user.plan,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        licenseKey: user.licenseKey,
      },
    };
  }
}

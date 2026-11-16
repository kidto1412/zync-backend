import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../application/ports/user.repository.port';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  private readonly fallbackMemoryUsers: User[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    try {
      const record = await this.prisma.user.findUnique({ where: { email } });
      if (!record) return null;
      return new User(
        record.id,
        record.email || '',
        record.password || '',
        record.name || undefined,
        record.plan as 'FREE' | 'PRO_LIFETIME',
        record.licenseKey || undefined,
        record.createdAt,
        record.updatedAt
      );
    } catch {
      const mem = this.fallbackMemoryUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      return mem || null;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const record = await this.prisma.user.findUnique({ where: { id } });
      if (!record) return null;
      return new User(
        record.id,
        record.email || '',
        record.password || '',
        record.name || undefined,
        record.plan as 'FREE' | 'PRO_LIFETIME',
        record.licenseKey || undefined,
        record.createdAt,
        record.updatedAt
      );
    } catch {
      const mem = this.fallbackMemoryUsers.find((u) => u.id === id);
      return mem || null;
    }
  }

  async create(user: User): Promise<User> {
    try {
      const record = await this.prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          password: user.passwordHash,
          name: user.name,
          plan: user.plan,
          licenseKey: user.licenseKey,
        },
      });
      return new User(
        record.id,
        record.email || '',
        record.password || '',
        record.name || undefined,
        record.plan as 'FREE' | 'PRO_LIFETIME',
        record.licenseKey || undefined,
        record.createdAt,
        record.updatedAt
      );
    } catch {
      this.fallbackMemoryUsers.push(user);
      return user;
    }
  }
}

import { User } from '../../domain/entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
}

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

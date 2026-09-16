import { Injectable } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { type JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput } from '@expense-tracker/shared';

import type { Env } from '../../config/env.schema';
import { type PrismaService } from '../../prisma/prisma.service';

/**
 * Каркас сервиса аутентификации.
 *
 * Реализация следующего этапа:
 *   register  — argon2.hash(password), создание User и стартовых категорий
 *   login     — argon2.verify, выпуск пары токенов
 *   refresh   — проверка хэша refresh-токена, ротация записи в refresh_tokens
 *   logout    — пометка revokedAt у текущего refresh-токена
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(_input: RegisterInput): Promise<AuthResponse> {
    throw new Error('Не реализовано');
  }

  async login(_input: LoginInput): Promise<AuthResponse> {
    throw new Error('Не реализовано');
  }

  async refresh(_refreshToken: string): Promise<AuthResponse> {
    throw new Error('Не реализовано');
  }

  async logout(_refreshToken: string): Promise<void> {
    throw new Error('Не реализовано');
  }
}

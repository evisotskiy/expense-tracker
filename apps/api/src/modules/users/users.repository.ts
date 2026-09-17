import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser, SupportedCurrency } from '@expense-tracker/shared';
// Не `import type`: нужен instanceof для распознавания P2002 при гонке на unique(email).
import { Prisma } from '@expense-tracker/database';

import { PrismaService } from '../../prisma/prisma.service';

/** Ровно поля authUserSchema — то, что уходит в AuthResponse.user. */
const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  baseCurrency: true,
} satisfies Prisma.UserSelect;

/** Профиль для GET users/me: то же самое + createdAt. passwordHash не включён намеренно. */
const PROFILE_SELECT = {
  ...AUTH_USER_SELECT,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Единственный select во всём приложении, поднимающий passwordHash.
 * Имя метода-потребителя (findCredentialsByEmail) специально «громкое»:
 * любой grep по passwordHash должен приводить сюда.
 */
const CREDENTIALS_SELECT = {
  ...AUTH_USER_SELECT,
  passwordHash: true,
} satisfies Prisma.UserSelect;

export interface UserProfile extends AuthUser {
  createdAt: Date;
}

export interface UserCredentials extends AuthUser {
  passwordHash: string;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name?: string;
  baseCurrency?: string;
}

type AuthUserRow = { id: string; email: string; name: string | null; baseCurrency: string };

/**
 * Единственная точка доступа к таблице users.
 *
 * Знает про Prisma (модели, select-наборы, коды ошибок) и не знает про HTTP:
 * возвращает данные или null, а решение «это 404/409» принимает вызывающая сторона.
 */
@Injectable()
export class UsersRepository {
  // @Inject: PrismaService используется здесь только как тип параметра —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findProfileById(id: string): Promise<UserProfile | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });

    return user ? { ...this.toAuthUser(user), createdAt: user.createdAt } : null;
  }

  async findAuthById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: AUTH_USER_SELECT,
    });

    return user ? this.toAuthUser(user) : null;
  }

  /**
   * Единственный метод, отдающий passwordHash. Используется только AuthService.login
   * (через GetUserCredentialsQuery) — хеш не должен покидать этот вызов.
   */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      select: CREDENTIALS_SELECT,
    });

    return user ? { ...this.toAuthUser(user), passwordHash: user.passwordHash } : null;
  }

  /**
   * Создаёт пользователя. Возвращает null, если email уже занят (P2002 на users_email_key),
   * а не бросает: код ошибки Prisma — деталь хранилища, решение «это 409 Conflict»
   * принимает сервис. Предварительной проверки «а вдруг занят» нет намеренно — это
   * гонка (TOCTOU) между SELECT и INSERT, уникальный индекс — единственный настоящий арбитр.
   */
  async create(data: CreateUserData): Promise<AuthUser | null> {
    try {
      const user = await this.prisma.client.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          baseCurrency: data.baseCurrency,
        },
        select: AUTH_USER_SELECT,
      });

      return this.toAuthUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }

      throw error;
    }
  }

  /**
   * В базе валюта — свободный VarChar(3), в контракте API — enum SUPPORTED_CURRENCIES.
   * Сужение типа безопасно: записать значение вне enum можно только в обход
   * registerSchema (миграцией или руками в psql), это приведение, а не валидация,
   * и гонять ответ через authUserSchema.parse() здесь нельзя — ZodError попал бы
   * в AllExceptionsFilter и превратился в 400 на совершенно исправном ответе.
   */
  private toAuthUser(row: AuthUserRow): AuthUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      baseCurrency: row.baseCurrency as SupportedCurrency,
    };
  }
}

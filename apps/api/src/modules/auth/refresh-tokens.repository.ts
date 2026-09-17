import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface CreateRefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const STORED_SELECT = {
  id: true,
  userId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
} as const;

/**
 * Доступ к таблице refresh_tokens. Внутренний для AuthModule — в отличие от UsersRepository,
 * через CQRS не ходит: сессии — деталь реализации auth, другим модулям она не нужна.
 */
@Injectable()
export class RefreshTokensRepository {
  // @Inject(PrismaService): PrismaService здесь используется только как тип параметра,
  // а при emitDecoratorMetadata это стирает класс из design:paramtypes (получаем
  // global Function вместо PrismaService) — см. подробный комментарий в jwt-auth.guard.ts.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.prisma.client.refreshToken.create({ data });
  }

  findById(id: string): Promise<StoredRefreshToken | null> {
    return this.prisma.client.refreshToken.findUnique({
      where: { id },
      select: STORED_SELECT,
    });
  }

  /**
   * Атомарная ротация: гасит старую запись и создаёт новую в одной транзакции.
   * Возвращает false, если старую запись уже успел погасить кто-то другой —
   * это и есть обнаружение гонки/повторного использования на уровне БД.
   */
  async rotate(oldId: string, next: CreateRefreshTokenData): Promise<boolean> {
    return this.prisma.client.$transaction(async (tx) => {
      // revokedAt: null в where — оптимистическая блокировка: если два запроса
      // пришли с одним и тем же токеном, ровно один увидит count === 1.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (count !== 1) {
        return false;
      }

      await tx.refreshToken.create({ data: next });
      return true;
    });
  }

  /** updateMany, а не update: отсутствующая запись не должна давать P2025 — logout идемпотентен. */
  async revoke(id: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Реакция на reuse detection: гасит все живые сессии пользователя. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

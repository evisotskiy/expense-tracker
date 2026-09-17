import { createHash } from 'node:crypto';

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { type CommandBus, type QueryBus } from '@nestjs/cqrs';
import { type ConfigService } from '@nestjs/config';
import { type JwtService } from '@nestjs/jwt';

// Фабричный мок: argon2id/timeCost/memoryCost реальны, а сами hash/verify —
// нативный биндинг весом ~50 мс на вызов. В спеках их два десятка плюс
// onModuleInit — секунды на ровном месте без единой пользы для теста.
// Настоящий round-trip остаётся в password.spec.ts.
jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

const argon2Mock = jest.requireMock('argon2') as {
  hash: jest.Mock;
  verify: jest.Mock;
};

import { ARGON2_OPTIONS, AuthService } from './auth.service';
import type { RefreshTokenPayload } from './auth.types';
import type { RefreshTokensRepository, StoredRefreshToken } from './refresh-tokens.repository';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const ENV: Record<string, string> = {
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  JWT_REFRESH_SECRET: 'r'.repeat(32),
  NODE_ENV: 'test',
};

// Моки берутся без jest.Mocked<Pick<...>> — реальные сигнатуры ConfigService.get
// и JwtService.signAsync перегружены под Zod/jsonwebtoken и не сопоставляются
// с упрощённой формой мока; строгая типизация здесь не добавляет пользы,
// только шум на месте вызова.
interface FakeJwt {
  signAsync: jest.Mock<Promise<string>, [payload: Record<string, unknown>, options?: unknown]>;
  verifyAsync: jest.Mock<Promise<RefreshTokenPayload>, [token: string, options?: unknown]>;
}

describe('AuthService', () => {
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let refreshTokens: jest.Mocked<RefreshTokensRepository>;
  let jwt: FakeJwt;
  let config: { get: jest.Mock };
  let service: AuthService;

  const context = { userAgent: 'jest', ip: '127.0.0.1' };

  beforeEach(async () => {
    jest.resetAllMocks();

    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };
    refreshTokens = {
      create: jest.fn(),
      findById: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;
    jwt = {
      // Порядок вызовов signAsync различается между issueTokens (access, потом refresh)
      // и refresh() (refresh, потом access) — различаем по форме payload, а не по позиции.
      signAsync: jest.fn((payload: Record<string, unknown>) =>
        Promise.resolve('tokenId' in payload ? 'refresh-token-raw' : 'access-token-raw'),
      ),
      verifyAsync: jest.fn(),
    };
    config = { get: jest.fn((key: string) => ENV[key]) };

    argon2Mock.hash.mockResolvedValue('dummy-hash-digest');
    argon2Mock.verify.mockResolvedValue(false);

    service = new AuthService(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
      refreshTokens,
      jwt as unknown as JwtService,
      config as unknown as ConfigService<never, true>,
    );

    // Заполняет dummyHash — без этого шага login() против несуществующего email
    // сравнивал бы пароль с пустой строкой, а не с фиктивным хешем.
    await service.onModuleInit();
    argon2Mock.hash.mockClear();
  });

  describe('register', () => {
    it('передаёт в CreateUserCommand хеш, а не исходный пароль', async () => {
      argon2Mock.hash.mockResolvedValue('argon2-digest');
      commandBus.execute.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        baseCurrency: 'RUB',
      });
      refreshTokens.create.mockResolvedValue(undefined);

      await service.register({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(argon2Mock.hash).toHaveBeenCalledWith('Passw0rd1', ARGON2_OPTIONS);
      const command = commandBus.execute.mock.calls[0]?.[0] as { passwordHash: string };
      expect(command.passwordHash).toBe('argon2-digest');
      expect(command).not.toHaveProperty('password');
    });

    it('не включает refreshToken в тело ответа (response)', async () => {
      commandBus.execute.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        baseCurrency: 'RUB',
      });
      refreshTokens.create.mockResolvedValue(undefined);

      const result = await service.register({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(Object.keys(result.response).sort()).toEqual(['accessToken', 'expiresIn', 'user']);
      expect(result.refreshToken).toBe('refresh-token-raw');
    });

    it('expiresIn === 900 при JWT_ACCESS_TTL = "15m"', async () => {
      commandBus.execute.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        baseCurrency: 'RUB',
      });
      refreshTokens.create.mockResolvedValue(undefined);

      const result = await service.register({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(result.response.expiresIn).toBe(900);
    });

    it('сохраняет tokenHash как sha256 от выданного refreshToken', async () => {
      commandBus.execute.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        baseCurrency: 'RUB',
      });
      refreshTokens.create.mockResolvedValue(undefined);

      const result = await service.register({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(refreshTokens.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          tokenHash: hashToken(result.refreshToken),
          userAgent: 'jest',
          ip: '127.0.0.1',
        }),
      );
    });

    it('бросает ConflictException, если email уже занят, и не создаёт refresh-токен', async () => {
      commandBus.execute.mockResolvedValue(null);

      await expect(
        service.register({ email: 'taken@b.c', password: 'Passw0rd1' }, context),
      ).rejects.toThrow(ConflictException);

      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const storedUser = {
      id: 'u1',
      email: 'a@b.c',
      name: 'Тест',
      baseCurrency: 'RUB' as const,
      passwordHash: 'stored-digest',
    };

    it('успешный вход выпускает пару токенов и создаёт запись refresh-токена', async () => {
      queryBus.execute.mockResolvedValue(storedUser);
      argon2Mock.verify.mockResolvedValue(true);
      refreshTokens.create.mockResolvedValue(undefined);

      const result = await service.login({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(argon2Mock.verify).toHaveBeenCalledWith('stored-digest', 'Passw0rd1');
      expect(result.response.accessToken).toBe('access-token-raw');
      expect(refreshTokens.create).toHaveBeenCalledTimes(1);
    });

    it('не пропускает passwordHash в response.user', async () => {
      queryBus.execute.mockResolvedValue(storedUser);
      argon2Mock.verify.mockResolvedValue(true);
      refreshTokens.create.mockResolvedValue(undefined);

      const result = await service.login({ email: 'a@b.c', password: 'Passw0rd1' }, context);

      expect(result.response.user).not.toHaveProperty('passwordHash');
    });

    it('неизвестный email: verify всё равно вызывается, против dummy-хеша', async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@b.c', password: 'anything' }, context),
      ).rejects.toThrow(UnauthorizedException);

      // Без этой проверки регрессия защиты по таймингу (условный verify) прошла бы незаметно.
      expect(argon2Mock.verify).toHaveBeenCalledWith('dummy-hash-digest', 'anything');
    });

    it('неизвестный email и неверный пароль дают одинаковое сообщение об ошибке', async () => {
      queryBus.execute.mockResolvedValue(null);
      const unknownEmailError = await service
        .login({ email: 'ghost@b.c', password: 'x' }, context)
        .catch((error: Error) => error);

      queryBus.execute.mockResolvedValue(storedUser);
      argon2Mock.verify.mockResolvedValue(false);
      const wrongPasswordError = await service
        .login({ email: 'a@b.c', password: 'wrong' }, context)
        .catch((error: Error) => error);

      expect(unknownEmailError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((unknownEmailError as Error).message).toBe((wrongPasswordError as Error).message);
    });

    it('неверный пароль у существующего пользователя не создаёт refresh-токен', async () => {
      queryBus.execute.mockResolvedValue(storedUser);
      argon2Mock.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.c', password: 'wrong' }, context),
      ).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const payload: RefreshTokenPayload = { sub: 'u1', email: 'a@b.c', tokenId: 'rt_1' };
    const validToken = 'refresh-token-raw';

    function storedFor(overrides: Partial<StoredRefreshToken> = {}): StoredRefreshToken {
      return {
        id: 'rt_1',
        userId: 'u1',
        tokenHash: hashToken(validToken),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        ...overrides,
      };
    }

    it('валидный токен ротирует запись и выдаёт новую пару', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor());
      queryBus.execute.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        name: null,
        baseCurrency: 'RUB',
      });
      refreshTokens.rotate.mockResolvedValue(true);

      const result = await service.refresh(validToken, context);

      expect(refreshTokens.rotate).toHaveBeenCalledWith(
        'rt_1',
        expect.objectContaining({ userId: 'u1' }),
      );
      expect(result.response.accessToken).toBe('access-token-raw');
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('verifyAsync проверяет подпись именно JWT_REFRESH_SECRET', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor());
      queryBus.execute.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' });
      refreshTokens.rotate.mockResolvedValue(true);

      await service.refresh(validToken, context);

      expect(jwt.verifyAsync).toHaveBeenCalledWith(
        validToken,
        expect.objectContaining({ secret: ENV.JWT_REFRESH_SECRET }),
      );
    });

    it('невалидная подпись: 401, в репозитории ничего не вызывается', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('garbage', context)).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.findById).not.toHaveBeenCalled();
    });

    it('запись не найдена: 401', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(null);

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);
    });

    it('reuse detection: отозванный токен гасит все сессии пользователя', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor({ revokedAt: new Date() }));

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('несовпадение tokenHash гасит все сессии пользователя', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor({ tokenHash: hashToken('другой-токен') }));

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('истёкшая запись: 401 и точечный revoke (не revokeAllForUser)', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(
        storedFor({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.revoke).toHaveBeenCalledWith('rt_1');
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('пользователь удалён (findAuthById вернул null): 401', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor());
      queryBus.execute.mockResolvedValue(null);

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);
    });

    it('параллельная ротация (rotate → false): 401 и гашение всех сессий', async () => {
      jwt.verifyAsync.mockResolvedValue(payload);
      refreshTokens.findById.mockResolvedValue(storedFor());
      queryBus.execute.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: null, baseCurrency: 'RUB' });
      refreshTokens.rotate.mockResolvedValue(false);

      await expect(service.refresh(validToken, context)).rejects.toThrow(UnauthorizedException);

      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('logout', () => {
    it('валидный токен отзывает соответствующую запись', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@b.c', tokenId: 'rt_1' });

      await service.logout('some-token');

      expect(refreshTokens.revoke).toHaveBeenCalledWith('rt_1');
    });

    it('невалидный токен не бросает', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(service.logout('garbage')).resolves.toBeUndefined();
      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });

    it('отсутствие токена ничего не вызывает и не бросает', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();

      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });
  });
});

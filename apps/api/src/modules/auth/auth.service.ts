import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, LoginInput, RegisterInput } from '@expense-tracker/shared';
import { argon2id, hash, type HashOptions, verify } from 'argon2';

import { parseDurationToSeconds } from '../../common/utils/duration';
import type { Env } from '../../config/env.schema';
import { CreateUserCommand } from '../users/commands/create-user.command';
import { GetAuthUserQuery } from '../users/queries/get-auth-user.query';
import { GetUserCredentialsQuery } from '../users/queries/get-user-credentials.query';
import {
  type AuthResult,
  type JwtPayload,
  type RefreshTokenPayload,
  type SessionContext,
} from './auth.types';
import { type CreateRefreshTokenData, RefreshTokensRepository } from './refresh-tokens.repository';

/**
 * Профиль OWASP Password Storage Cheat Sheet для argon2id (m=19 MiB, t=2, p=1).
 * Библиотечные дефолты (m=64 MiB, t=3, p=4) дороже втрое по памяти: десятки
 * одновременных логинов на одном инстансе упрутся в RSS раньше, чем в CPU.
 * argon2id указан явно, хотя он и дефолт: параметры хеширования — часть контракта
 * с уже сохранёнными хешами, их нельзя менять «просто по умолчанию» библиотеки.
 */
export const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Сравнение хешей за постоянное время — не даёт восстановить хеш по времени ответа. */
function matchesHash(token: string, storedHex: string): boolean {
  const candidate = Buffer.from(hashToken(token), 'hex');
  const stored = Buffer.from(storedHex, 'hex');

  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Хеш случайной строки: verify против него всегда false и стоит столько же,
   * сколько реальная проверка. Считается на старте с ARGON2_OPTIONS — захардкоженная
   * строка разъехалась бы с параметрами при их пересмотре, и тайминги начали бы отличаться.
   */
  private dummyHash = '';

  // @Inject на каждом параметре: без явного токена design:paramtypes стирается
  // до global Function (класс участвует в файле только как тип аннотации) —
  // подробности в common/guards/jwt-auth.guard.ts.
  constructor(
    @Inject(CommandBus) private readonly commandBus: CommandBus,
    @Inject(QueryBus) private readonly queryBus: QueryBus,
    @Inject(RefreshTokensRepository) private readonly refreshTokens: RefreshTokensRepository,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);
  }

  async register(input: RegisterInput, context: SessionContext): Promise<AuthResult> {
    const passwordHash = await hash(input.password, ARGON2_OPTIONS);

    // email уже нормализован (.toLowerCase().trim()) глобальным ZodValidationPipe —
    // здесь ничего дополнительно приводить не нужно. Тип результата (AuthUser | null)
    // выводится автоматически: CreateUserCommand наследуется от Command<AuthUser | null>.
    const user = await this.commandBus.execute(
      new CreateUserCommand(input.email, passwordHash, input.name, input.baseCurrency),
    );

    if (!user) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    // Стартовые категории не создаются намеренно (решение пользователя) — регистрация
    // отвечает только за создание учётной записи, наполнение категориями — отдельная задача.

    return this.issueTokens(user, context);
  }

  async login(input: LoginInput, context: SessionContext): Promise<AuthResult> {
    const user = await this.queryBus.execute(new GetUserCredentialsQuery(input.email));

    // verify вызывается даже когда пользователя нет — против фиктивного хеша.
    // Иначе ответ «нет такого email» возвращался бы за доли миллисекунды, а «неверный
    // пароль» — за время работы argon2, и разница в таймингах выдавала бы существование
    // учётной записи не хуже явного сообщения об ошибке.
    const passwordMatches = await verify(user?.passwordHash ?? this.dummyHash, input.password);

    if (!user || !passwordMatches) {
      // Одно и то же сообщение на оба случая — никаких «пользователь не найден».
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const { passwordHash: _passwordHash, ...authUser } = user;

    return this.issueTokens(authUser, context);
  }

  async refresh(token: string, context: SessionContext): Promise<AuthResult> {
    const invalid = () => new UnauthorizedException('Недействительный refresh-токен');

    let payload: RefreshTokenPayload;

    try {
      // Проверяем подпись и срок раньше похода в базу — на испорченном/чужом
      // токене ни одного запроса к БД не происходит.
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw invalid();
    }

    const stored = await this.refreshTokens.findById(payload.tokenId);

    if (!stored) {
      throw invalid();
    }

    if (stored.revokedAt) {
      // Токен уже был обменян, но кто-то предъявляет его снова. Законный клиент
      // так не делает — значит, копия токена есть у двух сторон, и какая из них
      // настоящая, мы не знаем. Гасим все живые сессии пользователя: принудительный
      // перелогин на всех устройствах дешевле, чем оставленный злоумышленнику доступ.
      this.logger.warn(`Повторное использование refresh-токена, userId=${stored.userId}`);
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw invalid();
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      // Дублирует проверку exp в самом JWT намеренно: база — источник истины,
      // и если JWT_REFRESH_TTL увеличили после выпуска токена, exp окажется мягче записи.
      await this.refreshTokens.revoke(stored.id);
      throw invalid();
    }

    if (!matchesHash(token, stored.tokenHash)) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw invalid();
    }

    // Данные берутся свежие из базы, а не из payload — за срок жизни refresh-токена
    // name/baseCurrency могли поменяться.
    const user = await this.queryBus.execute(new GetAuthUserQuery(payload.sub));

    if (!user) {
      throw invalid();
    }

    const next = this.buildRefreshToken(user, context);
    const rotated = await this.refreshTokens.rotate(stored.id, await next.record);

    if (!rotated) {
      // count === 0: параллельный запрос успел погасить запись между проверкой
      // и ротацией. Трактуем как повторное использование — консервативно и без гонок.
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw invalid();
    }

    const access = await this.signAccessToken(user);

    return {
      response: { user, accessToken: access.token, expiresIn: access.expiresIn },
      refreshToken: await next.token,
      refreshTokenMaxAgeMs: next.maxAgeMs,
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
      await this.refreshTokens.revoke(payload.tokenId);
    } catch {
      // Разлогин обязан быть идемпотентным: истёкший, испорченный или уже погашенный
      // токен — не ошибка, cookie контроллер всё равно очистит. 401 здесь означал бы
      // «не могу вас выпустить», что абсурдно.
    }
  }

  private async signAccessToken(user: AuthUser): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = parseDurationToSeconds(this.config.get('JWT_ACCESS_TTL', { infer: true }));
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email } satisfies JwtPayload);

    return { token, expiresIn };
  }

  /**
   * Готовит материал нового refresh-токена без записи в БД — используется и при
   * первичной выдаче (issueTokens), и при ротации (refresh), где создание записи
   * должно попасть в одну транзакцию с гашением старой.
   */
  private buildRefreshToken(
    user: AuthUser,
    context: SessionContext,
  ): { token: Promise<string>; record: Promise<CreateRefreshTokenData>; maxAgeMs: number } {
    const refreshTtl = parseDurationToSeconds(
      this.config.get('JWT_REFRESH_TTL', { infer: true }),
    );

    // tokenId генерируем сами и используем как первичный ключ строки refresh_tokens:
    // tokenHash — это хеш уже подписанного токена, а подписать токен без tokenId
    // нельзя — иначе получается «курица и яйцо».
    const tokenId = randomUUID();

    const token = this.jwt.signAsync(
      { sub: user.id, email: user.email, tokenId } satisfies RefreshTokenPayload,
      {
        // Второй секрет — чтобы украденный access нельзя было предъявить как refresh,
        // и наоборот: JwtStrategy проверяет только access-секретом.
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshTtl, // число, не строка — см. common/utils/duration.ts
      },
    );

    const record = token.then(
      (signed): CreateRefreshTokenData => ({
        id: tokenId,
        userId: user.id,
        tokenHash: hashToken(signed),
        expiresAt: new Date(Date.now() + refreshTtl * 1_000),
        userAgent: context.userAgent,
        ip: context.ip,
      }),
    );

    return { token, record, maxAgeMs: refreshTtl * 1_000 };
  }

  private async issueTokens(user: AuthUser, context: SessionContext): Promise<AuthResult> {
    const [access, next] = await Promise.all([
      this.signAccessToken(user),
      (async () => {
        const built = this.buildRefreshToken(user, context);
        const record = await built.record;
        await this.refreshTokens.create(record);
        return { token: await built.token, maxAgeMs: built.maxAgeMs };
      })(),
    ]);

    return {
      response: { user, accessToken: access.token, expiresIn: access.expiresIn },
      refreshToken: next.token,
      refreshTokenMaxAgeMs: next.maxAgeMs,
    };
  }
}

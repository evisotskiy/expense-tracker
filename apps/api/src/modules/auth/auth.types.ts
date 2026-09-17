import type { AuthResponse } from '@expense-tracker/shared';

/** Полезная нагрузка access-токена. */
export interface JwtPayload {
  /** id пользователя (стандартное поле JWT). */
  sub: string;
  email: string;
}

/** Полезная нагрузка refresh-токена: добавляет идентификатор записи в refresh_tokens. */
export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string;
}

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Путь cookie с учётом setGlobalPrefix('api/v1'). Общий для установки и очистки. */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

/** Откуда пришёл вход — пишется в refresh_tokens как контекст сессии. */
export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
}

/**
 * Результат AuthService: тело ответа плюс то, что нужно контроллеру для cookie.
 *
 * refreshToken намеренно не входит в AuthResponse — по контракту authResponseSchema
 * из shared он никогда не попадает в JSON, только в httpOnly cookie.
 */
export interface AuthResult {
  response: AuthResponse;
  refreshToken: string;
  /** Срок жизни cookie в миллисекундах — прямо в CookieOptions.maxAge. */
  refreshTokenMaxAgeMs: number;
}

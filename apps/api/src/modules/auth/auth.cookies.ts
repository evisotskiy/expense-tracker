import type { CookieOptions } from 'express';

import type { Env } from '../../config/env.schema';
import { REFRESH_TOKEN_COOKIE_PATH } from './auth.types';

/**
 * Единая фабрика опций cookie для refresh-токена — используется и при установке
 * (res.cookie), и при очистке (res.clearCookie). Если у них разойдутся path/sameSite/
 * secure, браузер не удалит cookie при logout: он сверяет эти атрибуты с cookie
 * в хранилище, а не только имя.
 */
export function refreshCookieOptions(nodeEnv: Env['NODE_ENV'], maxAgeMs?: number): CookieOptions {
  const isProduction = nodeEnv === 'production';

  return {
    httpOnly: true, // JS не читает — XSS не уносит долгоживущий токен
    secure: isProduction, // в dev https нет, иначе cookie просто не установится
    sameSite: isProduction ? 'none' : 'lax',
    // Полный путь, включая setGlobalPrefix('api/v1'): браузер сравнивает path
    // с URL запроса, а не с маршрутом Nest. Ограничение до /api/v1/auth означает,
    // что refresh-cookie не уходит вместе с каждым запросом к /expenses.
    path: REFRESH_TOKEN_COOKIE_PATH,
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

import 'client-only';

import type { AuthResponse } from '@expense-tracker/shared';

import { accessTokenStore } from './access-token-store';
import { apiFetch, ApiRequestError } from './api-client';

const REFRESH_LOCK_NAME = 'expense-tracker:auth-refresh';

let refreshPromise: Promise<AuthResponse | null> | null = null;

/**
 * Single-flight внутри вкладки + navigator.locks между вкладками.
 *
 * Это не оптимизация, а защита от самоподрыва: бэкенд ротирует refresh-токен
 * и при повторном предъявлении отозванного вызывает revokeAllForUser. Без
 * блокировки несколько вкладок, восстановленных при старте браузера,
 * одновременно пошлют одну и ту же cookie — первая ротация пройдёт, остальные
 * попадут в reuse detection, и пользователя выкинет со всех устройств.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshPromise ??= runRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function runRefresh(): Promise<AuthResponse | null> {
  // Web Locks требует secure context; фолбэк тихий, но не молчаливо снижает
  // защиту — в одной вкладке single-flight выше всё равно работает.
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(REFRESH_LOCK_NAME, () => performRefresh());
  }
  return performRefresh();
}

async function performRefresh(): Promise<AuthResponse | null> {
  try {
    // apiFetch, а не authorizedFetch — рекурсия невозможна по построению.
    const response = await apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' });
    accessTokenStore.set(response.accessToken, response.expiresIn);
    return response;
  } catch (error) {
    // Только 401/403 означают «сессии нет». Сеть, 429 и 5xx пробрасываются
    // наверх — гасить сессию из-за отвалившегося wi-fi нельзя.
    if (error instanceof ApiRequestError && (error.statusCode === 401 || error.statusCode === 403)) {
      accessTokenStore.clear();
      accessTokenStore.emitExpired();
      return null;
    }
    throw error;
  }
}

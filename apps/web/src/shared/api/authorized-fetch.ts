import 'client-only';

import { accessTokenStore } from './access-token-store';
import { apiFetch, ApiRequestError, type RequestOptions } from './api-client';
import { refreshSession } from './refresh-session';

/**
 * Обёртка apiFetch для защищённых эндпоинтов.
 *
 * Проактивного таймера обновления нет: реактивная ветка на 401 обязательна
 * в любом случае (только она переживает сон ноутбука, заморозку фоновых
 * вкладок и отзыв токена сервером). isExpiring() по локальным часам —
 * дешёвая проактивность, которая просто снимает лишний круговой рейс.
 */
export async function authorizedFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (accessTokenStore.isExpiring()) {
    await refreshSession();
  }

  try {
    return await apiFetch<T>(path, { ...options, accessToken: accessTokenStore.get() ?? undefined });
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 401) {
      await refreshSession();
      // Ровно один повтор через apiFetch — не authorizedFetch, иначе при
      // повторном 401 получилась бы рекурсия.
      return apiFetch<T>(path, { ...options, accessToken: accessTokenStore.get() ?? undefined });
    }
    throw error;
  }
}

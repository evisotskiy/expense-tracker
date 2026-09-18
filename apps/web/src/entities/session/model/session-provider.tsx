'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { accessTokenStore } from '@/shared/api/access-token-store';

import { sessionKeys } from './session-keys';
import { useSession } from './use-session';

/**
 * Единственное место, где транспорт встречается с навигацией. Монтирование
 * useSession запускает bootstrap; подписка на onExpired обрабатывает разрыв
 * сессии, что бы его ни вызвало — реактивный 401 в authorized-fetch или
 * отказ refresh-session.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useSession();

  useEffect(() => {
    return accessTokenStore.onExpired(() => {
      // Порядок важен: сначала очистить кэш чужого пользователя, потом сразу
      // подставить null — иначе смонтированный observer перезапустит queryFn
      // и при живой cookie пользователь молча «войдёт обратно».
      queryClient.clear();
      queryClient.setQueryData(sessionKeys.current(), null);
      // '/login' появляется как реальный маршрут только в шаге 12 плана —
      // каст не убирать, typedRoutes не видит его раньше первого next build.
      router.replace('/login' as Route);
    });
  }, [queryClient, router]);

  return children;
}

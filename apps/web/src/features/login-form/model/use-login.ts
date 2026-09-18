'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse } from '@expense-tracker/shared';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';

import { sessionKeys } from '@/entities/session';
import { accessTokenStore } from '@/shared/api/access-token-store';
import { apiFetch } from '@/shared/api/api-client';
import { safeNextPath } from '@/shared/lib/navigation/safe-next-path';

import type { LoginFormData } from './schema';

/**
 * apiFetch, а не authorizedFetch: токена ещё нет, а 401 здесь легитимный
 * ответ (неверный пароль), не сигнал разорванной сессии.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMutation({
    mutationFn: (values: LoginFormData) =>
      apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: values }),
    onSuccess: (session) => {
      // Пользователя берём из ответа — не тратим лишний рейс на /users/me
      // и не ротируем свежий refresh-токен запросом, который не нужен.
      accessTokenStore.set(session.accessToken, session.expiresIn);
      queryClient.setQueryData(sessionKeys.current(), session.user);

      const target = safeNextPath(searchParams.get('next')) ?? '/dashboard';
      router.replace(target as Route);
    },
  });
}

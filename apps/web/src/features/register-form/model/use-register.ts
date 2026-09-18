'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse } from '@expense-tracker/shared';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { sessionKeys } from '@/entities/session';
import { accessTokenStore } from '@/shared/api/access-token-store';
import { apiFetch } from '@/shared/api/api-client';

import type { RegisterPayload } from './schema';

/** apiFetch, а не authorizedFetch: токена ещё нет. */
export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (values: RegisterPayload) =>
      apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: values }),
    onSuccess: (session) => {
      accessTokenStore.set(session.accessToken, session.expiresIn);
      queryClient.setQueryData(sessionKeys.current(), session.user);
      // '/dashboard' появляется как маршрут только в шаге 13 плана — каст
      // не убирать, typedRoutes не видит его раньше первого next build.
      router.replace('/dashboard' as Route);
    },
  });
}

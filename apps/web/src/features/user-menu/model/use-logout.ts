'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { sessionKeys } from '@/entities/session';
import { accessTokenStore } from '@/shared/api/access-token-store';
import { apiFetch } from '@/shared/api/api-client';

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    // Логин по refresh-cookie, не по access-токену — apiFetch достаточно.
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    // onSettled, а не onSuccess: при недоступном сервере локально выйти
    // всё равно обязаны.
    onSettled: () => {
      // Порядок критичен: clear() токена → queryClient.clear() → сразу
      // setQueryData(null). Без последнего смонтированный observer
      // перезапустит queryFn, и при живой cookie пользователь молча
      // «войдёт обратно».
      accessTokenStore.clear();
      queryClient.clear();
      queryClient.setQueryData(sessionKeys.current(), null);
      router.replace('/login');
    },
  });
}

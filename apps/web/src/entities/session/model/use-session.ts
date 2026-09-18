import { useQuery } from '@tanstack/react-query';

import { bootstrapSession } from '../api/session-api';
import { sessionKeys } from './session-keys';

/**
 * Три состояния кодируются бесплатно через data: undefined — «ещё не знаем»,
 * null — аноним, объект — авторизован.
 *
 * staleTime/gcTime: Infinity и retry: false — актуальность токена держит
 * транспорт (authorized-fetch/refresh-session), а не react-query; повторный
 * запрос по фокусу окна давал бы лишние ротации refresh-токена.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionKeys.current(),
    queryFn: bootstrapSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

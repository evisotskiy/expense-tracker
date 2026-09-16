'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

import { ApiRequestError } from '@/lib/api-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // QueryClient создаётся внутри useState, а не в модуле: на сервере модуль общий
  // для всех запросов, и кэш одного пользователя утёк бы другому.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error) => {
              // 4xx повторять бессмысленно: ответ не изменится от повтора
              if (error instanceof ApiRequestError && error.statusCode < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

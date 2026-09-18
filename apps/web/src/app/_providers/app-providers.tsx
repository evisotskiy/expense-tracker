'use client';

import type { ReactNode } from 'react';

import { SessionProvider } from '@/entities/session';

import { QueryProvider } from './query-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>{children}</SessionProvider>
    </QueryProvider>
  );
}
